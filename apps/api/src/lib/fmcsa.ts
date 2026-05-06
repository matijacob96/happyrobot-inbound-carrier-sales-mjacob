import { request } from "undici";

export interface FmcsaCarrierResponse {
  eligible: boolean;
  carrier_name?: string;
  dot_number?: string;
  allowed_to_operate?: boolean;
  reasons: string[];
}

interface FmcsaRawCarrier {
  legalName?: string;
  dotNumber?: number | string;
  allowedToOperate?: "Y" | "N" | string;
  statusCode?: string;
  outOfService?: boolean | string;
  outOfServiceDate?: string | null;
}

interface FmcsaApiEnvelope {
  content?:
    | {
        carrier?: FmcsaRawCarrier;
      }
    | Array<{ carrier?: FmcsaRawCarrier }>;
  retrievalDate?: string;
}

const REQUEST_TIMEOUT_MS = 8_000;

function normalizeMcNumber(input: string): string {
  return input.replace(/[^0-9]/g, "").trim();
}

function pickCarrier(envelope: FmcsaApiEnvelope): FmcsaRawCarrier | undefined {
  const content = envelope.content;
  if (!content) return undefined;
  if (Array.isArray(content)) {
    return content[0]?.carrier;
  }
  return content.carrier;
}

export class FmcsaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly mock: boolean = false,
  ) {}

  async verifyMcNumber(mcNumber: string): Promise<FmcsaCarrierResponse> {
    const normalized = normalizeMcNumber(mcNumber);
    if (!normalized) {
      return {
        eligible: false,
        reasons: ["mc_number_format_invalid"],
      };
    }

    if (this.mock) {
      // Local-dev fallback for non-US IPs (FMCSA geo-blocks the endpoint).
      // Accepts any MC with 6+ digits; rejects everything else.
      const eligible = normalized.length >= 6;
      return {
        eligible,
        carrier_name: eligible ? `Mock Carrier ${normalized}` : undefined,
        dot_number: eligible ? `DOT-${normalized}` : undefined,
        allowed_to_operate: eligible,
        reasons: eligible ? ["mock_mode"] : ["mc_number_too_short", "mock_mode"],
      };
    }

    const url = `${this.baseUrl}/carriers/docket-number/${normalized}?webKey=${encodeURIComponent(this.apiKey)}`;

    let body: unknown;
    try {
      const res = await request(url, {
        method: "GET",
        headers: { accept: "application/json" },
        bodyTimeout: REQUEST_TIMEOUT_MS,
        headersTimeout: REQUEST_TIMEOUT_MS,
      });

      if (res.statusCode === 404) {
        return { eligible: false, reasons: ["mc_number_not_found"] };
      }
      if (res.statusCode >= 500) {
        return { eligible: false, reasons: ["fmcsa_unavailable"] };
      }
      if (res.statusCode >= 400) {
        return { eligible: false, reasons: [`fmcsa_http_${res.statusCode}`] };
      }

      body = await res.body.json();
    } catch (err) {
      return {
        eligible: false,
        reasons: ["fmcsa_unavailable", err instanceof Error ? err.message : "unknown"],
      };
    }

    const envelope = body as FmcsaApiEnvelope;
    const carrier = pickCarrier(envelope);
    if (!carrier) {
      return { eligible: false, reasons: ["mc_number_not_found"] };
    }

    const allowedRaw = carrier.allowedToOperate;
    const allowed =
      typeof allowedRaw === "string" ? allowedRaw.toUpperCase() === "Y" : Boolean(allowedRaw);
    const outOfService =
      typeof carrier.outOfService === "string"
        ? carrier.outOfService.toUpperCase() === "Y"
        : Boolean(carrier.outOfService);

    const reasons: string[] = [];
    if (!allowed) reasons.push("not_allowed_to_operate");
    if (outOfService) reasons.push("out_of_service");

    return {
      eligible: allowed && !outOfService,
      carrier_name: carrier.legalName,
      dot_number: carrier.dotNumber !== undefined ? String(carrier.dotNumber) : undefined,
      allowed_to_operate: allowed,
      reasons,
    };
  }
}

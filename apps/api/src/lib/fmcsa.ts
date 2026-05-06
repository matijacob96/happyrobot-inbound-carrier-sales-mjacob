import { request } from "undici";

/**
 * Carrier verification client backed by FMCSA's Open Data Program (Socrata).
 *
 * Why Socrata instead of QCMobile?
 *
 * The FMCSA QCMobile API (mobile.fmcsa.dot.gov) requires a free webKey but
 * geo-blocks non-US IPs at the network layer — it returns 403 before even
 * checking credentials. That makes the canonical API unusable for any team
 * working outside the US, including this POC.
 *
 * The same agency publishes the *Company Census File* dataset on
 * data.transportation.gov (DOT's open-data portal, powered by Socrata). The
 * dataset is the underlying source feeding QCMobile, refreshed daily, and
 * reachable from anywhere with no authentication. The trade-off is freshness
 * (≤ 24 h vs real-time on QCMobile); for carrier eligibility checks that
 * change on the order of weeks/months, this is acceptable.
 *
 * Adding `X-App-Token` (free registration) only raises Socrata's anonymous
 * rate limits; it is not required for correctness.
 */

export interface FmcsaCarrierResponse {
  eligible: boolean;
  carrier_name?: string;
  dot_number?: string;
  allowed_to_operate?: boolean;
  reasons: string[];
}

/** Subset of fields we care about from the Company Census record. */
interface SocrataCarrierRow {
  legal_name?: string;
  dba_name?: string;
  dot_number?: string;
  docket1?: string;
  docket1prefix?: string;
  /** "A" = active, "I" = inactive, "X" = out of business, etc. */
  status_code?: string;
  /** "A" = active MC authority, "I" = inactive, etc. */
  docket1_status_code?: string;
  /** "Y" = authority was previously revoked. */
  prior_revoke_flag?: string;
  /** "S" = Satisfactory, "C" = Conditional, "U" = Unsatisfactory, null = unrated. */
  safety_rating?: string | null;
  /** "AUTHORIZED FOR HIRE" / "EXEMPT FOR HIRE" / "PRIVATE" / etc. */
  classdef?: string;
}

/**
 * Socrata's anonymous endpoint has fairly variable latency (we've seen
 * everything from 200 ms to ~10 s). 12 s leaves headroom for the slow path
 * without making the carrier wait too long; if it still trips, we do one
 * quick retry before giving up.
 */
const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_COUNT = 1;
const RETRY_BACKOFF_MS = 500;
/** FMCSA Company Census File on data.transportation.gov (Socrata 4×4 id). */
const DATASET_ID = "az4n-8mr2";

function normalizeMcNumber(input: string): string {
  return input.replace(/[^0-9]/g, "").trim();
}

export class FmcsaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly appToken?: string,
  ) {}

  async verifyMcNumber(mcNumber: string): Promise<FmcsaCarrierResponse> {
    const normalized = normalizeMcNumber(mcNumber);
    if (!normalized) {
      return { eligible: false, reasons: ["mc_number_format_invalid"] };
    }

    // Lookup by docket1 (MC number) + docket1prefix=MC. The dataset also
    // indexes MX/FF prefixes — we restrict to MC for this carrier-sales POC.
    const params = new URLSearchParams({
      docket1: normalized,
      docket1prefix: "MC",
      $limit: "1",
    });
    const url = `${this.baseUrl.replace(/\/$/, "")}/resource/${DATASET_ID}.json?${params.toString()}`;

    const headers: Record<string, string> = { accept: "application/json" };
    if (this.appToken) headers["X-App-Token"] = this.appToken;

    let lastError = "unknown";
    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      try {
        const res = await request(url, {
          method: "GET",
          headers,
          bodyTimeout: REQUEST_TIMEOUT_MS,
          headersTimeout: REQUEST_TIMEOUT_MS,
        });

        if (res.statusCode === 429) {
          return { eligible: false, reasons: ["fmcsa_rate_limited"] };
        }
        if (res.statusCode >= 500) {
          // Server error: worth a retry.
          lastError = `fmcsa_http_${res.statusCode}`;
          await res.body.dump();
          if (attempt < RETRY_COUNT) {
            await sleep(RETRY_BACKOFF_MS);
            continue;
          }
          return { eligible: false, reasons: ["fmcsa_unavailable"] };
        }
        if (res.statusCode >= 400) {
          return { eligible: false, reasons: [`fmcsa_http_${res.statusCode}`] };
        }

        const body = (await res.body.json()) as unknown;
        const rows = Array.isArray(body) ? (body as SocrataCarrierRow[]) : [];
        const row = rows[0];
        if (!row) {
          return { eligible: false, reasons: ["mc_number_not_found"] };
        }
        return mapRowToResponse(row);
      } catch (err) {
        // Most often: Headers Timeout Error from undici. Retry once.
        lastError = err instanceof Error ? err.message : "unknown";
        if (attempt < RETRY_COUNT) {
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
      }
    }

    return { eligible: false, reasons: ["fmcsa_unavailable", lastError] };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply the eligibility rules. The Company Census schema doesn't have a single
 * `allowedToOperate` flag like QCMobile does, so we derive it from a
 * combination of status fields. A carrier is eligible iff:
 *
 *   - `status_code === "A"`             → carrier entity is active
 *   - `docket1_status_code === "A"`     → MC authority is active
 *   - `prior_revoke_flag !== "Y"`       → authority was never revoked
 *   - `safety_rating !== "U"`           → not Unsatisfactory (S, C and unrated are ok)
 *
 * Each failed rule is appended to `reasons` so the caller (and the dashboard)
 * can show why a carrier was rejected.
 */
function mapRowToResponse(row: SocrataCarrierRow): FmcsaCarrierResponse {
  const reasons: string[] = [];

  const carrierActive = row.status_code === "A";
  if (!carrierActive) reasons.push("carrier_inactive");

  const mcActive = row.docket1_status_code === "A";
  if (!mcActive) reasons.push("mc_authority_inactive");

  const revoked = row.prior_revoke_flag === "Y";
  if (revoked) reasons.push("prior_authority_revoked");

  const unsatisfactory = row.safety_rating === "U";
  if (unsatisfactory) reasons.push("unsatisfactory_safety_rating");

  const eligible = carrierActive && mcActive && !revoked && !unsatisfactory;

  // Prefer the legal name; fall back to DBA when missing.
  const carrierName = row.legal_name ?? row.dba_name;

  return {
    eligible,
    carrier_name: carrierName ? titleCase(carrierName) : undefined,
    dot_number: row.dot_number,
    allowed_to_operate: carrierActive && mcActive,
    reasons,
  };
}

/**
 * Socrata returns names in upper case ("GREYHOUND LINES INC"). We pretty-print
 * to title case for the agent's pitch and the dashboard, while preserving
 * common acronyms (LLC, INC, CO, USA, ...).
 */
function titleCase(input: string): string {
  const ACRONYMS = new Set(["LLC", "INC", "CO", "CORP", "LTD", "USA", "DBA", "II", "III", "IV"]);
  return input
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => {
      if (!part.trim()) return part;
      const upper = part.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

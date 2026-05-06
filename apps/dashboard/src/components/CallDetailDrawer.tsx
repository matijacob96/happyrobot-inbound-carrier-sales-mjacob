import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { CallRow } from "../lib/api";
import { Badge, type BadgeTone } from "./ui/badge";
import { ChatTranscript } from "./ChatTranscript";
import { formatCurrency, formatDateTime } from "../lib/utils";

const OUTCOME_TONES: Record<string, BadgeTone> = {
  booked: "success",
  declined: "warning",
  not_eligible: "danger",
  no_load_found: "info",
  drop_off: "default",
};
const SENTIMENT_TONES: Record<string, BadgeTone> = {
  positive: "success",
  neutral: "default",
  negative: "danger",
};

interface CallDetailDrawerProps {
  call: CallRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CallDetailDrawer({ call, open, onOpenChange }: CallDetailDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer-content">
          {call && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 sticky top-0 bg-inherit z-10">
                <div>
                  <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    Call {call.call_id}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(call.started_at ?? call.persisted_at)}
                    {call.duration_seconds != null && (
                      <> · {Math.round(call.duration_seconds)}s</>
                    )}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    aria-label="Close"
                    className="rounded p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Quick facts */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Carrier">{call.carrier_name ?? "—"}</Field>
                  <Field label="MC #">
                    <span className="font-mono">{call.mc_number ?? "—"}</span>
                  </Field>
                  <Field label="Load">
                    <span className="font-mono">{call.load_id ?? "—"}</span>
                  </Field>
                  <Field label="Final rate">{formatCurrency(call.final_rate)}</Field>
                  <Field label="Outcome">
                    <Badge tone={OUTCOME_TONES[call.outcome] ?? "default"}>
                      {call.outcome}
                    </Badge>
                  </Field>
                  <Field label="Sentiment">
                    <Badge tone={SENTIMENT_TONES[call.sentiment] ?? "default"}>
                      {call.sentiment}
                    </Badge>
                  </Field>
                  <Field label="Agreed">{call.agreed ? "Yes" : "No"}</Field>
                  <Field label="Rounds">
                    {call.rounds_count ?? call.rounds?.length ?? 0}
                  </Field>
                </div>

                {/* Negotiation rounds */}
                {Array.isArray(call.rounds) && call.rounds.length > 0 && (
                  <section>
                    <SectionHeader>Negotiation rounds</SectionHeader>
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs uppercase">
                            <th className="text-left px-3 py-2">#</th>
                            <th className="text-left px-3 py-2">Carrier offer</th>
                            <th className="text-left px-3 py-2">Action</th>
                            <th className="text-left px-3 py-2">Counter</th>
                          </tr>
                        </thead>
                        <tbody>
                          {call.rounds.map((row) => (
                            <tr
                              key={row.round}
                              className="border-t border-slate-100 dark:border-white/5"
                            >
                              <td className="px-3 py-2">{row.round}</td>
                              <td className="px-3 py-2 font-mono">
                                {formatCurrency(row.carrier_offer)}
                              </td>
                              <td className="px-3 py-2">{row.action ?? "—"}</td>
                              <td className="px-3 py-2 font-mono">
                                {formatCurrency(row.counter_offer)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Transcript */}
                <section>
                  <SectionHeader>Transcript</SectionHeader>
                  <ChatTranscript raw={call.transcript_summary} />
                </section>

                {/* Raw payload */}
                <section>
                  <details className="text-xs text-slate-500 dark:text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                      Raw payload
                    </summary>
                    <pre className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 overflow-auto max-h-64 text-slate-700 dark:text-slate-200">
                      {JSON.stringify(call, null, 2)}
                    </pre>
                  </details>
                </section>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="text-slate-900 dark:text-slate-100 mt-1">{children}</div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
      {children}
    </div>
  );
}

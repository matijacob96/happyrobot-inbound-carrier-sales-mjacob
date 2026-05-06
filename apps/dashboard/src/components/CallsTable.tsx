import { Badge, type BadgeTone } from "./ui/badge";
import type { CallRow } from "../lib/api";
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

interface CallsTableProps {
  rows: CallRow[];
  onSelect?: (row: CallRow) => void;
  loading?: boolean;
}

export function CallsTable({ rows, onSelect, loading = false }: CallsTableProps) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Carrier</th>
            <th>MC</th>
            <th>Load</th>
            <th>Outcome</th>
            <th>Sentiment</th>
            <th className="text-right">Final rate</th>
            <th>Rounds</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-slate-500 py-10">
                {loading
                  ? "Loading calls…"
                  : "No calls captured yet. Run a test call from HappyRobot to see data here."}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.call_id}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={() => onSelect?.(r)}
            >
              <td className="text-slate-500 dark:text-slate-300">
                {formatDateTime(r.persisted_at ?? r.started_at)}
              </td>
              <td>{r.carrier_name ?? "—"}</td>
              <td className="font-mono text-xs">{r.mc_number ?? "—"}</td>
              <td className="font-mono text-xs">{r.load_id ?? "—"}</td>
              <td>
                <Badge tone={OUTCOME_TONES[r.outcome] ?? "default"}>{r.outcome}</Badge>
              </td>
              <td>
                <Badge tone={SENTIMENT_TONES[r.sentiment] ?? "default"}>{r.sentiment}</Badge>
              </td>
              <td className="text-right font-mono">{formatCurrency(r.final_rate)}</td>
              <td>{r.rounds_count ?? r.rounds?.length ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

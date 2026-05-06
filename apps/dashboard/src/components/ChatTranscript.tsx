import { Bot, User as UserIcon, Wrench } from "lucide-react";
import { cn } from "../lib/utils";

interface TranscriptMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp?: string;
}

/**
 * Tries to parse `transcript_summary` as JSON (HappyRobot can ship the
 * full message log when the workflow injects `@call.transcript`).
 * Falls back to a single assistant bubble with the plain text summary.
 */
function parseTranscript(raw: string | undefined): TranscriptMessage[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Direct JSON array.
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((msg) => normalizeMessage(msg))
        .filter((m): m is TranscriptMessage => m !== null);
    }
    if (parsed && typeof parsed === "object") {
      // HappyRobot sometimes returns { messages: [...] }
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.messages)) {
        return obj.messages
          .map((msg) => normalizeMessage(msg))
          .filter((m): m is TranscriptMessage => m !== null);
      }
      if (Array.isArray(obj.transcript)) {
        return obj.transcript
          .map((msg) => normalizeMessage(msg))
          .filter((m): m is TranscriptMessage => m !== null);
      }
    }
  } catch {
    // not JSON — fall through.
  }

  // role: content lines pattern
  if (/^(assistant|user|bot|carrier|agent|tool|system)\s*:/im.test(trimmed)) {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const out: TranscriptMessage[] = [];
    for (const line of lines) {
      const m = line.match(/^(assistant|user|bot|carrier|agent|tool|system)\s*:\s*(.*)$/i);
      if (!m) {
        const last = out[out.length - 1];
        if (last) last.content += `\n${line}`;
        continue;
      }
      const role = mapRole(m[1] ?? "");
      out.push({ role, content: m[2] ?? "" });
    }
    if (out.length) return out;
  }

  // Fallback: single assistant bubble with the whole summary.
  return [{ role: "assistant", content: trimmed }];
}

function mapRole(raw: string): TranscriptMessage["role"] {
  const r = raw.toLowerCase();
  if (r === "user" || r === "carrier") return "user";
  if (r === "tool") return "tool";
  if (r === "system") return "system";
  return "assistant";
}

function normalizeMessage(msg: unknown): TranscriptMessage | null {
  if (!msg || typeof msg !== "object") return null;
  const m = msg as Record<string, unknown>;
  const rawRole = (m.role ?? m.speaker ?? m.from) as string | undefined;
  if (!rawRole) return null;
  const content =
    (m.content as string | undefined) ??
    (m.text as string | undefined) ??
    (m.message as string | undefined) ??
    "";
  if (typeof content !== "string") return null;
  return {
    role: mapRole(rawRole),
    content,
    timestamp: (m.timestamp as string | undefined) ?? (m.time as string | undefined),
  };
}

export function ChatTranscript({ raw }: { raw: string | undefined }) {
  const messages = parseTranscript(raw);

  if (messages.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 italic">
        No transcript captured for this call.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((m, idx) => (
        <Bubble key={idx} message={m} />
      ))}
    </div>
  );
}

function Bubble({ message }: { message: TranscriptMessage }) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system" || message.role === "tool";

  return (
    <div
      className={cn(
        "flex gap-2 items-start",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div
          className={cn(
            "h-7 w-7 shrink-0 rounded-full flex items-center justify-center mt-0.5",
            isSystem
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
              : "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200",
          )}
        >
          {isSystem ? <Wrench className="h-3.5 w-3.5" /> : <Bot className="h-4 w-4" />}
        </div>
      )}
      <div
        className={cn(
          "bubble whitespace-pre-wrap",
          isUser && "bubble-user",
          isAssistant && "bubble-assistant",
          isSystem && (message.role === "system" ? "bubble-system" : "bubble-tool"),
        )}
      >
        {message.content}
      </div>
      {isUser && (
        <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 flex items-center justify-center mt-0.5">
          <UserIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

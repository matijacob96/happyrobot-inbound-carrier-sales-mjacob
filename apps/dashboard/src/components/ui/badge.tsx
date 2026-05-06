import { cn } from "../../lib/utils";

const tones = {
  default: "bg-slate-500/15 text-slate-200 border-slate-500/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  info: "bg-brand-500/15 text-brand-300 border-brand-500/30",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "default",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("pill border", tones[tone], className)}>{children}</span>
  );
}

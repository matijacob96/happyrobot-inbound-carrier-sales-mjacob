import type { MetricsSummary } from "@hr/shared";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

const OUTCOME_COLORS: Record<string, string> = {
  booked: "#22c55e",
  declined: "#f97316",
  not_eligible: "#ef4444",
  no_load_found: "#a855f7",
  drop_off: "#64748b",
};
const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#94a3b8",
  negative: "#ef4444",
};

const tooltipStyle = {
  backgroundColor: "rgba(15,23,42,0.95)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function emptyState(label: string) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-500">
      {label}
    </div>
  );
}

export function OutcomePie({ data }: { data: MetricsSummary }) {
  const series = Object.entries(data.by_outcome)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <ChartCard title="Calls by outcome" subtitle="Final classification per call">
      {series.length === 0 ? (
        emptyState("No call outcomes yet")
      ) : (
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={series}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {series.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={OUTCOME_COLORS[entry.name] ?? "#64748b"}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ color: "#cbd5f5", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function SentimentBar({ data }: { data: MetricsSummary }) {
  const series = Object.entries(data.by_sentiment).map(([name, value]) => ({
    name,
    value,
  }));

  const total = series.reduce((sum, s) => sum + s.value, 0);

  return (
    <ChartCard title="Carrier sentiment" subtitle="Real-time HappyRobot classifier">
      {total === 0 ? (
        emptyState("No sentiment recorded yet")
      ) : (
        <ResponsiveContainer>
          <BarChart data={series}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {series.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={SENTIMENT_COLORS[entry.name] ?? "#64748b"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function CallsPerDayLine({ data }: { data: MetricsSummary }) {
  return (
    <ChartCard title="Call volume" subtitle="Total inbound calls per day">
      {data.calls_per_day.length === 0 ? (
        emptyState("No traffic recorded yet")
      ) : (
        <ResponsiveContainer>
          <LineChart data={data.calls_per_day}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#5089ff"
              strokeWidth={2}
              dot={{ r: 3, fill: "#5089ff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function TopLoads({ data }: { data: MetricsSummary }) {
  const merged = new Map<string, { pitched: number; booked: number }>();
  for (const r of data.top_loads_pitched) {
    merged.set(r.load_id, { pitched: r.count, booked: 0 });
  }
  for (const r of data.top_loads_booked) {
    const cur = merged.get(r.load_id) ?? { pitched: 0, booked: 0 };
    cur.booked = r.count;
    merged.set(r.load_id, cur);
  }
  const series = [...merged.entries()].map(([load_id, v]) => ({ load_id, ...v }));

  return (
    <ChartCard title="Top loads" subtitle="Pitched vs booked">
      {series.length === 0 ? (
        emptyState("No loads pitched yet")
      ) : (
        <ResponsiveContainer>
          <BarChart data={series} layout="vertical">
            <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="load_id"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              width={70}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend wrapperStyle={{ color: "#cbd5f5", fontSize: 12 }} />
            <Bar dataKey="pitched" stackId="a" fill="#5089ff" radius={[0, 4, 4, 0]} />
            <Bar dataKey="booked" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Point {
  date: string;
  sessions: number;
  cost_cents: number;
  lines_added: number;
  lines_removed: number;
  commits: number;
}

export function MemberDailyChart({ data }: { data: Point[] }) {
  const enriched = data.map((d) => ({
    ...d,
    cost_usd: d.cost_cents / 100,
    label: d.date.slice(5), // MM-DD
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={enriched} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#82837A", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "#82837A", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: "#82837A", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
        />
        <Tooltip
          contentStyle={{
            background: "#F3F1EE",
            border: "none",
            borderRadius: 8,
            fontSize: "0.8125rem",
          }}
          formatter={(value: number, name: string) => {
            if (name === "cost_usd") return [`$${value.toFixed(2)}`, "推定コスト"];
            if (name === "sessions") return [value, "セッション"];
            if (name === "commits") return [value, "コミット"];
            return [value, name];
          }}
          labelFormatter={(label, payload) => {
            const p = (payload && payload[0] && payload[0].payload) as { date: string } | undefined;
            return p?.date ?? label;
          }}
        />
        <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
        <Bar yAxisId="left" dataKey="sessions" name="セッション" fill="#C4C1B0" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="commits"  name="コミット"  fill="#82837A" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="cost_usd" name="推定コスト ($)" stroke="#35362D" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

"use client";

// RevenueChart — Dark Cosmic theme:
// - تدرج لوني هادئ من #6f86ff إلى #a78bfa.
// - Tooltip داكن متناسق مع RTL والتواريخ بالعربية.
// - Grid lines خفيفة لا تُشتّت.
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Row = { day: string; orders: number; revenue: number };

function formatDayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

function formatEgpShort(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function RevenueChart({ data }: { data: Row[] }) {
  const chartData = data.map((x) => ({
    ...x,
    egp: x.revenue / 100,
    label: formatDayLabel(x.day),
  }));

  return (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueGradientV2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6f86ff" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6f86ff" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="rgba(255,255,255,0.05)"
          />

          <XAxis
            dataKey="label"
            fontSize={10.5}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tick={{ fill: "#8d97c4" }}
            minTickGap={20}
          />
          <YAxis
            fontSize={10.5}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#8d97c4" }}
            tickFormatter={formatEgpShort}
            width={48}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(7,9,26,0.96)",
              borderRadius: "12px",
              border: "1px solid rgba(143,168,255,0.25)",
              boxShadow: "0 10px 30px -12px rgba(111,134,255,0.4)",
              color: "#eaf0ff",
              fontSize: "12px",
              fontFamily: "inherit",
              direction: "rtl",
              padding: "10px 12px",
              backdropFilter: "blur(12px)",
            }}
            labelStyle={{ color: "#8d97c4", fontSize: "11px", marginBottom: "4px" }}
            itemStyle={{ color: "#eaf0ff" }}
            formatter={(value: number) => [
              `${value.toLocaleString("en-US")} ج.م`,
              "المبيعات",
            ]}
            labelFormatter={(label) => `التاريخ: ${label}`}
          />

          <Area
            type="monotone"
            dataKey="egp"
            stroke="#8fa8ff"
            strokeWidth={2.5}
            fill="url(#revenueGradientV2)"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#8fa8ff",
              stroke: "#07091a",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
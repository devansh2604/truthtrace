"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion } from "framer-motion";

interface VerdictBarProps {
  verified: number;
  unverified: number;
  hallucinated: number;
}

const COLORS: Record<string, string> = {
  Verified: "#10b981",
  Unverified: "#f59e0b",
  Hallucinated: "#ef4444",
};

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p style={{ color: COLORS[payload[0].name] }}>
          {payload[0].name}: <strong>{payload[0].value}</strong>
        </p>
      </div>
    );
  }
  return null;
};

export function VerdictBar({ verified, unverified, hallucinated }: VerdictBarProps) {
  const data = [
    { name: "Verified", count: verified },
    { name: "Unverified", count: unverified },
    { name: "Hallucinated", count: hallucinated },
  ];

  return (
    <motion.div
      className="verdict-bar-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <h3 className="card-section-title">Verdict Breakdown</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
          barSize={20}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={92}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

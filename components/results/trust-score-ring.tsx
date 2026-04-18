"use client";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { useCounter } from "@/hooks/use-counter";

interface TrustScoreRingProps {
  score: number;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function getLabel(score: number): string {
  if (score >= 75) return "Highly Reliable";
  if (score >= 55) return "Partially Reliable";
  if (score >= 35) return "Questionable";
  return "Unreliable";
}

export function TrustScoreRing({ score }: TrustScoreRingProps) {
  const displayScore = useCounter(score, 1200, true);
  const color = getScoreColor(score);

  const data = [
    { name: "Trust", value: score, fill: color },
  ];

  return (
    <motion.div
      className="trust-ring-card"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="trust-ring-label">Trust Score</div>
      <div className="trust-ring-chart">
        <ResponsiveContainer width="100%" height={220}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="90%"
            startAngle={225}
            endAngle={-45}
            data={data}
            barSize={16}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              dataKey="value"
              cornerRadius={8}
              background={{ fill: "rgba(255,255,255,0.07)" }}
              isAnimationActive={true}
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="trust-score-center">
          <span className="trust-number" style={{ color }}>
            {displayScore}
          </span>
          <span className="trust-slash">/100</span>
          <span className="trust-verdict" style={{ color }}>
            {getLabel(score)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

"use client";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, BarChart3 } from "lucide-react";
import { useCounter } from "@/hooks/use-counter";

interface MetricCardsProps {
  total: number;
  verified: number;
  unverified: number;
  hallucinated: number;
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  delay: number;
}

function MetricCard({
  label,
  value,
  icon,
  color,
  borderColor,
  delay,
}: MetricCardProps) {
  const displayValue = useCounter(value, 1000, true);

  return (
    <motion.div
      className="metric-card"
      style={{ "--border-color": borderColor } as React.CSSProperties}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="metric-icon" style={{ color }}>
        {icon}
      </div>
      <div className="metric-number" style={{ color }}>
        {displayValue}
      </div>
      <div className="metric-label">{label}</div>
    </motion.div>
  );
}

export function MetricCards({
  total,
  verified,
  unverified,
  hallucinated,
}: MetricCardsProps) {
  const cards = [
    {
      label: "Total Claims",
      value: total,
      icon: <BarChart3 size={22} />,
      color: "#667eea",
      borderColor: "rgba(102,126,234,0.4)",
      delay: 0,
    },
    {
      label: "Verified",
      value: verified,
      icon: <CheckCircle size={22} />,
      color: "#10b981",
      borderColor: "rgba(16,185,129,0.4)",
      delay: 0.08,
    },
    {
      label: "Unverified",
      value: unverified,
      icon: <AlertCircle size={22} />,
      color: "#f59e0b",
      borderColor: "rgba(245,158,11,0.4)",
      delay: 0.16,
    },
    {
      label: "Hallucinated",
      value: hallucinated,
      icon: <XCircle size={22} />,
      color: "#ef4444",
      borderColor: "rgba(239,68,68,0.4)",
      delay: 0.24,
    },
  ];

  return (
    <div className="metric-cards-grid">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}

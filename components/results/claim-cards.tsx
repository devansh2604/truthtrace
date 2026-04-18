"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ClaimResult } from "@/lib/types";

type Filter = "all" | "verified" | "unverified" | "hallucinated";

interface ClaimCardsProps {
  claims: ClaimResult[];
  streaming?: boolean;
}

const VERDICT_CONFIG = {
  verified: {
    icon: <CheckCircle size={18} />,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
    label: "Verified",
  },
  unverified: {
    icon: <AlertCircle size={18} />,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    label: "Unverified",
  },
  hallucinated: {
    icon: <XCircle size={18} />,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
    label: "Hallucinated",
  },
};

function ClaimCard({
  claim,
  index,
}: {
  claim: ClaimResult;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = VERDICT_CONFIG[claim.verdict];

  return (
    <motion.div
      className="claim-card"
      style={{
        "--accent": cfg.color,
        "--accent-bg": cfg.bg,
        "--accent-border": cfg.border,
        borderColor: cfg.border,
      } as React.CSSProperties}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {/* Header */}
      <div className="claim-header">
        <div className="claim-verdict-badge" style={{ color: cfg.color, background: cfg.bg }}>
          {cfg.icon}
          <span>{cfg.label}</span>
        </div>
        <div className="claim-confidence">
          <div className="confidence-bar-track">
            <div
              className="confidence-bar-fill"
              style={{ width: `${claim.confidence}%`, background: cfg.color }}
            />
          </div>
          <span style={{ color: cfg.color }}>{claim.confidence}%</span>
        </div>
      </div>

      {/* Claim text */}
      <p className="claim-text">{claim.claim}</p>

      {/* Reasoning */}
      <p className="claim-reasoning">{claim.reasoning}</p>

      {/* Supporting quote */}
      {claim.supporting_quote && (
        <blockquote className="claim-quote">
          &ldquo;{claim.supporting_quote}&rdquo;
        </blockquote>
      )}

      {/* Sources */}
      {claim.sources.length > 0 && (
        <div className="claim-sources">
          {claim.sources.slice(0, 3).map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noreferrer"
              className={`source-chip source-${src.source}`}
            >
              <span>{src.source === "wikipedia" ? "📖" : "🔍"}</span>
              <span className="source-title">
                {src.title.length > 28 ? src.title.slice(0, 28) + "…" : src.title}
              </span>
              <ExternalLink size={11} />
            </a>
          ))}
        </div>
      )}

      {/* Type tag */}
      <div className="claim-type-row">
        <span className="claim-type-tag">{claim.type}</span>
      </div>
    </motion.div>
  );
}

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Unverified", value: "unverified" },
  { label: "Hallucinated", value: "hallucinated" },
];

export function ClaimCards({ claims, streaming }: ClaimCardsProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered =
    filter === "all" ? claims : claims.filter((c) => c.verdict === filter);

  return (
    <div className="claim-cards-section">
      <div className="claim-cards-header">
        <h3 className="card-section-title">
          Claim Analysis
          {streaming && (
            <span className="streaming-badge">
              <span className="streaming-dot" /> Live
            </span>
          )}
        </h3>

        <div className="filter-tabs" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              className={`filter-tab ${filter === f.value ? "active" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className="filter-count">
                {f.value === "all"
                  ? claims.length
                  : claims.filter((c) => c.verdict === f.value).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            className="empty-filter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            No claims with this verdict yet.
          </motion.div>
        ) : (
          <div className="claim-cards-grid">
            {filtered.map((claim, i) => (
              <ClaimCard key={claim.id} claim={claim} index={i} />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

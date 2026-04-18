"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Globe, HelpCircle } from "lucide-react";
import { ClaimResult, Verdict } from "@/lib/types";

type Filter = "all" | "verified" | "unverified" | "hallucinated" | "pending";

interface ClaimCardsProps {
  claims: ClaimResult[];
  streaming?: boolean;
  onVerdictOverride?: (claimId: string, verdict: Verdict | null) => void;
}

const VERDICT_CONFIG = {
  verified: {
    icon: <CheckCircle size={14} />,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
    label: "Verified",
  },
  unverified: {
    icon: <AlertCircle size={14} />,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    label: "Unverified",
  },
  hallucinated: {
    icon: <XCircle size={14} />,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
    label: "Hallucinated",
  },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="score-ring-wrapper">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="21" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <circle
          cx="26" cy="26" r="21"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${(score / 100) * 132} 132`}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="score-ring-label" style={{ color }}>
        <span className="score-ring-number">{score}</span>
        <span className="score-ring-pct">%</span>
      </div>
    </div>
  );
}

function SourceBar({ supporting, contradicting, total }: {
  supporting: number; contradicting: number; total: number;
}) {
  if (total === 0) return null;
  const supportPct = (supporting / total) * 100;
  const contradictPct = (contradicting / total) * 100;
  const neutralPct = 100 - supportPct - contradictPct;
  return (
    <div className="source-bar-wrapper">
      <div className="source-bar-label">
        <span style={{ color: "#10b981" }}>↑ {supporting} agree</span>
        <span style={{ color: "rgba(255,255,255,0.35)" }}>·</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>{Math.round(neutralPct / 100 * total)} neutral</span>
        <span style={{ color: "rgba(255,255,255,0.35)" }}>·</span>
        <span style={{ color: "#ef4444" }}>↓ {contradicting} disagree</span>
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.35)" }}>{total} sources</span>
      </div>
      <div className="source-bar-track">
        <div className="source-bar-fill-support" style={{ width: `${supportPct}%` }} />
        <div className="source-bar-fill-neutral" style={{ width: `${neutralPct}%` }} />
        <div className="source-bar-fill-contra" style={{ width: `${contradictPct}%` }} />
      </div>
    </div>
  );
}

function ClaimCard({ claim, index, onVerdictOverride }: {
  claim: ClaimResult;
  index: number;
  onVerdictOverride?: (id: string, v: Verdict | null) => void;
}) {
  const [showSources, setShowSources] = useState(false);
  const uv = claim.userVerdict;
  const cfg = uv ? VERDICT_CONFIG[uv] : null;

  const cardBorder = cfg ? cfg.border : "rgba(255,255,255,0.08)";
  const cardBg = cfg ? cfg.bg : "rgba(255,255,255,0.03)";

  return (
    <motion.div
      className="claim-card"
      style={{ borderColor: cardBorder, background: cardBg } as React.CSSProperties}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
    >
      {/* Top row: score ring + claim */}
      <div className="claim-top-row">
        <ScoreRing score={claim.sourceScore} />
        <div className="claim-top-content">
          <p className="claim-text">{claim.claim}</p>
          <div className="claim-type-row">
            <span className="claim-type-tag">{claim.type}</span>
            {uv ? (
              <span className="user-verdict-chip" style={{ color: cfg!.color, background: cfg!.bg, borderColor: cfg!.border }}>
                {cfg!.icon} {cfg!.label} <span className="by-you">by you</span>
              </span>
            ) : (
              <span className="pending-chip">
                <HelpCircle size={11} /> Pending your decision
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Source bar */}
      <SourceBar
        supporting={claim.supportingCount}
        contradicting={claim.contradictingCount}
        total={claim.totalSources}
      />

      {/* What the evidence says */}
      <p className="claim-reasoning">{claim.reasoning}</p>

      {claim.supporting_quote && (
        <blockquote className="claim-quote">"{claim.supporting_quote}"</blockquote>
      )}

      {/* Sources */}
      {claim.sources.length > 0 && (
        <div className="sources-section">
          <button className="sources-toggle" onClick={() => setShowSources((p) => !p)}>
            <Globe size={11} />
            {showSources ? "Hide" : "Show"} {claim.sources.length} sources
          </button>
          <AnimatePresence>
            {showSources && (
              <motion.div
                className="sources-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {claim.sources.map((src, i) => {
                  const dot = src.supports === "yes" ? "#10b981" : src.supports === "no" ? "#ef4444" : "rgba(255,255,255,0.2)";
                  return (
                    <div key={i} className="source-row">
                      <span className="source-dot" style={{ background: dot }} />
                      <div className="source-info">
                        <div className="source-domain">{src.domain}</div>
                        <p className="source-snippet">{src.snippet.slice(0, 120)}…</p>
                      </div>
                      {src.url && (
                        <a href={src.url} target="_blank" rel="noreferrer" className="source-link">
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* User decision — the only verdict that matters */}
      <div className="override-section">
        <span className="override-label">Your decision:</span>
        <div className="override-btns">
          {(["verified", "unverified", "hallucinated"] as Verdict[]).map((v) => {
            const c = VERDICT_CONFIG[v];
            const isActive = uv === v;
            return (
              <button
                key={v}
                className={`override-btn ${isActive ? "active" : ""}`}
                style={{
                  borderColor: isActive ? c.color : "rgba(255,255,255,0.1)",
                  color: isActive ? c.color : "rgba(255,255,255,0.5)",
                  background: isActive ? c.bg : "transparent",
                }}
                onClick={() => onVerdictOverride?.(claim.id, isActive ? null : v)}
                title={isActive ? "Click to undo" : `Mark as ${v}`}
              >
                {c.icon}
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Unverified", value: "unverified" },
  { label: "Hallucinated", value: "hallucinated" },
];

export function ClaimCards({ claims, streaming, onVerdictOverride }: ClaimCardsProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = claims.filter((c) => {
    if (filter === "all") return true;
    if (filter === "pending") return c.userVerdict === null;
    return c.userVerdict === filter;
  });

  const counts = {
    all: claims.length,
    pending: claims.filter((c) => c.userVerdict === null).length,
    verified: claims.filter((c) => c.userVerdict === "verified").length,
    unverified: claims.filter((c) => c.userVerdict === "unverified").length,
    hallucinated: claims.filter((c) => c.userVerdict === "hallucinated").length,
  };

  return (
    <div className="claim-cards-section">
      <div className="claim-cards-header">
        <h3 className="card-section-title">
          Claims
          {streaming && (
            <span className="streaming-badge">
              <span className="streaming-dot" /> Live
            </span>
          )}
          {counts.pending > 0 && !streaming && (
            <span className="pending-badge">{counts.pending} awaiting your decision</span>
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
              <span className="filter-count">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div key="empty" className="empty-filter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            No claims here yet.
          </motion.div>
        ) : (
          <div className="claim-cards-grid">
            {filtered.map((claim, i) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                index={i}
                onVerdictOverride={onVerdictOverride}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

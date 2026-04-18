"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Globe } from "lucide-react";
import { ClaimResult, Verdict } from "@/lib/types";

type Filter = "all" | "verified" | "unverified" | "hallucinated";

interface ClaimCardsProps {
  claims: ClaimResult[];
  streaming?: boolean;
  onVerdictOverride?: (claimId: string, verdict: Verdict) => void;
}

const VERDICT_CONFIG = {
  verified: {
    icon: <CheckCircle size={16} />,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
    label: "Verified",
  },
  unverified: {
    icon: <AlertCircle size={16} />,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    label: "Unverified",
  },
  hallucinated: {
    icon: <XCircle size={16} />,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
    label: "Hallucinated",
  },
};

function SourceBar({ supporting, contradicting, total }: {
  supporting: number; contradicting: number; total: number;
}) {
  const supportPct = total > 0 ? (supporting / total) * 100 : 0;
  const contradictPct = total > 0 ? (contradicting / total) * 100 : 0;
  const neutralPct = 100 - supportPct - contradictPct;

  return (
    <div className="source-bar-wrapper">
      <div className="source-bar-label">
        <span style={{ color: "#10b981" }}>↑ {supporting} supporting</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{Math.round(neutralPct / 100 * total)} neutral</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
        <span style={{ color: "#ef4444" }}>↓ {contradicting} contradicting</span>
        <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: "auto" }}>{total} sources</span>
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
  onVerdictOverride?: (id: string, v: Verdict) => void;
}) {
  const [showSources, setShowSources] = useState(false);
  const activeVerdict = claim.userVerdict ?? claim.verdict;
  const cfg = VERDICT_CONFIG[activeVerdict];
  const isUserOverridden = claim.userVerdict !== null;

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
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
    >
      {/* Header */}
      <div className="claim-header">
        <div className="claim-verdict-badge" style={{ color: cfg.color, background: cfg.bg }}>
          {cfg.icon}
          <span>{cfg.label}</span>
          {isUserOverridden && (
            <span className="user-override-tag">You</span>
          )}
        </div>
        <div className="claim-confidence">
          <div className="confidence-bar-track">
            <div className="confidence-bar-fill" style={{ width: `${claim.confidence}%`, background: cfg.color }} />
          </div>
          <span style={{ color: cfg.color, fontWeight: 700 }}>{claim.confidence}%</span>
        </div>
      </div>

      {/* Claim text */}
      <p className="claim-text">{claim.claim}</p>

      {/* Source bar */}
      <SourceBar
        supporting={claim.supportingCount}
        contradicting={claim.contradictingCount}
        total={claim.totalSources}
      />

      {/* Reasoning */}
      <p className="claim-reasoning">{claim.reasoning}</p>

      {/* Supporting quote */}
      {claim.supporting_quote && (
        <blockquote className="claim-quote">"{claim.supporting_quote}"</blockquote>
      )}

      {/* Sources toggle */}
      {claim.sources.length > 0 && (
        <div className="sources-section">
          <button className="sources-toggle" onClick={() => setShowSources(p => !p)}>
            <Globe size={12} />
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
                  const supColor =
                    src.supports === "yes" ? "#10b981" :
                    src.supports === "no" ? "#ef4444" : "rgba(255,255,255,0.3)";
                  return (
                    <div key={i} className="source-row">
                      <span className="source-dot" style={{ background: supColor }} />
                      <div className="source-info">
                        <div className="source-domain">{src.domain}</div>
                        <p className="source-snippet">{src.snippet.slice(0, 120)}…</p>
                      </div>
                      <a href={src.url} target="_blank" rel="noreferrer" className="source-link">
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* User verdict override */}
      <div className="override-section">
        <span className="override-label">Your verdict:</span>
        <div className="override-btns">
          {(["verified", "unverified", "hallucinated"] as Verdict[]).map((v) => {
            const c = VERDICT_CONFIG[v];
            const isActive = activeVerdict === v && isUserOverridden;
            return (
              <button
                key={v}
                className={`override-btn ${isActive ? "active" : ""}`}
                style={{
                  borderColor: isActive ? c.color : "rgba(255,255,255,0.1)",
                  color: isActive ? c.color : "rgba(255,255,255,0.45)",
                  background: isActive ? c.bg : "transparent",
                }}
                onClick={() => onVerdictOverride?.(claim.id, v)}
                title={`Mark as ${v}`}
              >
                {c.icon}
                <span>{c.label}</span>
              </button>
            );
          })}
          {isUserOverridden && (
            <button
              className="override-btn reset-btn"
              onClick={() => onVerdictOverride?.(claim.id, claim.verdict)}
              title="Reset to AI verdict"
            >
              ↺ AI
            </button>
          )}
        </div>
      </div>

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

export function ClaimCards({ claims, streaming, onVerdictOverride }: ClaimCardsProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const effectiveClaims = claims.map((c) => ({
    ...c,
    verdict: (c.userVerdict ?? c.verdict) as Verdict,
  }));

  const filtered =
    filter === "all" ? effectiveClaims : effectiveClaims.filter((c) => c.verdict === filter);

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
                  ? effectiveClaims.length
                  : effectiveClaims.filter((c) => c.verdict === f.value).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div key="empty" className="empty-filter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            No claims with this verdict.
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

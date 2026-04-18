"use client";
import { useState, useRef } from "react";
import { ClaimResult, Verdict } from "@/lib/types";
import { motion } from "framer-motion";

interface AnnotatedDocProps {
  text: string;
  claims: ClaimResult[];
}

const VERDICT_STYLES: Record<Verdict, { className: string; bg: string; color: string }> = {
  verified: { className: "annotated-verified", bg: "rgba(16,185,129,0.15)", color: "#10b981" },
  unverified: { className: "annotated-unverified", bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
  hallucinated: { className: "annotated-hallucinated", bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
};

// For pending claims (no user verdict) use a neutral style
const PENDING_STYLE = { className: "annotated-pending", bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" };

interface Segment { text: string; claim?: ClaimResult; }

function buildSegments(text: string, claims: ClaimResult[]): Segment[] {
  const positioned = claims
    .map((c) => { const idx = text.indexOf(c.span); return { claim: c, start: idx, end: idx + c.span.length }; })
    .filter((p) => p.start !== -1)
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const pos of positioned) {
    if (pos.start < cursor) continue;
    if (pos.start > cursor) segments.push({ text: text.slice(cursor, pos.start) });
    segments.push({ text: pos.claim.span, claim: pos.claim });
    cursor = pos.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

interface TooltipState { x: number; y: number; claim: ClaimResult; }

export function AnnotatedDoc({ text, claims }: AnnotatedDocProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const segments = buildSegments(text, claims);

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>, claim: ClaimResult) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setTooltip({ x: rect.left - containerRect.left, y: rect.bottom - containerRect.top + 6, claim });
  };

  return (
    <motion.div className="annotated-doc-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
      <h3 className="card-section-title">Annotated Document</h3>
      <div className="annotated-legend">
        <span className="legend-item verified-legend">✓ Verified (by you)</span>
        <span className="legend-item unverified-legend">⚠ Unverified (by you)</span>
        <span className="legend-item hallucinated-legend">✗ Hallucinated (by you)</span>
        <span className="legend-item" style={{ color: "rgba(255,255,255,0.4)" }}>○ Pending</span>
      </div>
      <div className="annotated-body" ref={containerRef}>
        {segments.map((seg, i) => {
          if (!seg.claim) return <span key={i}>{seg.text}</span>;
          const uv = seg.claim.userVerdict;
          const style = uv ? VERDICT_STYLES[uv] : PENDING_STYLE;
          return (
            <span
              key={i}
              className={`annotated-span ${style.className}`}
              style={{
                background: style.bg,
                borderBottom: `2px solid ${style.color}`,
                textDecoration: uv === "hallucinated" ? "line-through" : "underline",
                textDecorationColor: style.color,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => handleMouseEnter(e, seg.claim!)}
              onMouseLeave={() => setTooltip(null)}
            >
              {seg.text}
            </span>
          );
        })}

        {tooltip && (
          <div className="annotation-tooltip" style={{ left: `${Math.min(tooltip.x, 400)}px`, top: `${tooltip.y}px` }}>
            <div className="tooltip-verdict" style={{ color: tooltip.claim.userVerdict ? VERDICT_STYLES[tooltip.claim.userVerdict].color : "rgba(255,255,255,0.4)" }}>
              {tooltip.claim.userVerdict ? tooltip.claim.userVerdict.toUpperCase() : "PENDING"} — {tooltip.claim.sourceScore}% source agreement
            </div>
            <div className="tooltip-reasoning">{tooltip.claim.reasoning}</div>
            {tooltip.claim.supporting_quote && (
              <div className="tooltip-quote">
                &ldquo;{tooltip.claim.supporting_quote.slice(0, 120)}{tooltip.claim.supporting_quote.length > 120 ? "…" : ""}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

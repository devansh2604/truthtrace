"use client";
import dynamic from "next/dynamic";
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileJson, AlertTriangle } from "lucide-react";
import { Hero } from "@/components/hero";
import { ConfigCard } from "@/components/config-card";
import { AuditButton } from "@/components/audit-button";
import { MetricCards } from "@/components/results/metric-cards";
import { AnnotatedDoc } from "@/components/results/annotated-doc";
import { ClaimCards } from "@/components/results/claim-cards";
import { SAMPLE_TEXT, GROQ_MODELS } from "@/lib/constants";
import { generateMarkdownReport, generateJSONPayload, downloadFile } from "@/lib/export";
import type { AuditResult, ClaimResult, StreamEvent, Verdict } from "@/lib/types";

const TrustScoreRing = dynamic(
  () => import("@/components/results/trust-score-ring").then((m) => m.TrustScoreRing),
  { ssr: false }
);
const VerdictBar = dynamic(
  () => import("@/components/results/verdict-bar").then((m) => m.VerdictBar),
  { ssr: false }
);

interface Progress { phase: string; current: number; total: number; }

function computeAuditStats(claims: ClaimResult[]) {
  const decided = claims.filter((c) => c.userVerdict !== null);
  const verifiedCount = decided.filter((r) => r.userVerdict === "verified").length;
  const hallucinatedCount = decided.filter((r) => r.userVerdict === "hallucinated").length;
  const unverifiedCount = decided.filter((r) => r.userVerdict === "unverified").length;
  const pendingCount = claims.filter((r) => r.userVerdict === null).length;
  const verifiedAvgScore = verifiedCount > 0
    ? decided.filter((r) => r.userVerdict === "verified").reduce((s, r) => s + r.sourceScore, 0) / verifiedCount
    : 0;
  const trustScore = decided.length > 0
    ? Math.min(100, Math.max(0, Math.round((verifiedCount / claims.length) * verifiedAvgScore)))
    : 0;
  return { verifiedCount, hallucinatedCount, unverifiedCount, pendingCount, trustScore, decidedCount: decided.length };
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(GROQ_MODELS[0].value);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [streamingClaims, setStreamingClaims] = useState<ClaimResult[]>([]);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canAudit = !!apiKey.trim() && !!text.trim() && !loading;

  const handleAudit = async () => {
    if (!canAudit) return;
    setLoading(true);
    setError(null);
    setAuditResult(null);
    setStreamingClaims([]);
    setProgress({ phase: "Connecting…", current: 0, total: 0 });
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, apiKey, model }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event: StreamEvent = JSON.parse(raw);
            if (event.type === "claim_start") {
              setProgress({
                phase: event.total > 0
                  ? `Scraping sources for claim ${event.claimIndex + 1}/${event.total}`
                  : "Extracting claims…",
                current: event.claimIndex,
                total: event.total,
              });
            } else if (event.type === "claim_result") {
              setStreamingClaims((prev) => [...prev, event.result]);
            } else if (event.type === "complete") {
              setAuditResult(event.audit);
              setStreamingClaims([]);
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleVerdictOverride = useCallback((claimId: string, verdict: Verdict | null) => {
    setAuditResult((prev) => {
      if (!prev) return prev;
      const updatedClaims = prev.claims.map((c) =>
        c.id === claimId ? { ...c, userVerdict: verdict } : c
      );
      const stats = computeAuditStats(updatedClaims);
      return {
        ...prev,
        claims: updatedClaims,
        trustScore: stats.trustScore,
        verifiedCount: stats.verifiedCount,
        unverifiedCount: stats.unverifiedCount,
        hallucinatedCount: stats.hallucinatedCount,
        pendingCount: stats.pendingCount,
        decidedCount: stats.decidedCount,
      };
    });
  }, []);

  const isStreaming = loading && streamingClaims.length > 0;

  return (
    <main>
      <Hero />
      <div className="main-container">
        <ConfigCard
          apiKey={apiKey}
          setApiKey={setApiKey}
          model={model}
          setModel={setModel}
          onLoadSample={() => setText(SAMPLE_TEXT)}
        />

        <div className="doc-textarea-wrapper">
          <label htmlFor="doc-input" className="doc-label">Document to Audit</label>
          <textarea
            id="doc-input"
            className="doc-textarea"
            placeholder="Paste any AI-generated document here… or click 'Load Sample Doc' above."
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>

        <AuditButton onClick={handleAudit} loading={loading} disabled={!canAudit} progress={progress} />

        {error && (
          <motion.div className="error-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </motion.div>
        )}

        <AnimatePresence>
          {isStreaming && streamingClaims.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: 24 }}>
              <ClaimCards claims={streamingClaims} streaming={true} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {auditResult && (
            <motion.div
              className="results-section"
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="results-top-row">
                <TrustScoreRing score={auditResult.trustScore} />
                <VerdictBar
                  verified={auditResult.verifiedCount}
                  unverified={auditResult.unverifiedCount}
                  hallucinated={auditResult.hallucinatedCount}
                />
              </div>

              <MetricCards
                total={auditResult.totalClaims}
                verified={auditResult.verifiedCount}
                unverified={auditResult.unverifiedCount}
                hallucinated={auditResult.hallucinatedCount}
              />

              <AnnotatedDoc text={text} claims={auditResult.claims} />

              <div className="export-row">
                <button className="export-btn" onClick={() => downloadFile(generateMarkdownReport(text, auditResult), `truthtrace-audit-${Date.now()}.md`, "text/markdown")}>
                  <Download size={15} /> Download Markdown
                </button>
                <button className="export-btn" onClick={() => downloadFile(generateJSONPayload(text, auditResult), `truthtrace-audit-${Date.now()}.json`, "application/json")}>
                  <FileJson size={15} /> Download JSON
                </button>
              </div>

              <div style={{ marginTop: 24 }}>
                <ClaimCards
                  claims={auditResult.claims}
                  streaming={false}
                  onVerdictOverride={handleVerdictOverride}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

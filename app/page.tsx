"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileJson, AlertTriangle } from "lucide-react";
import { Hero } from "@/components/hero";
import { ConfigCard } from "@/components/config-card";
import { AuditButton } from "@/components/audit-button";
import { TrustScoreRing } from "@/components/results/trust-score-ring";
import { MetricCards } from "@/components/results/metric-cards";
import { VerdictBar } from "@/components/results/verdict-bar";
import { AnnotatedDoc } from "@/components/results/annotated-doc";
import { ClaimCards } from "@/components/results/claim-cards";
import { SAMPLE_TEXT, GROQ_MODELS } from "@/lib/constants";
import { generateMarkdownReport, generateJSONPayload, downloadFile } from "@/lib/export";
import type { AuditResult, ClaimResult, StreamEvent } from "@/lib/types";

interface Progress {
  phase: string;
  current: number;
  total: number;
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
                  ? `Verifying claim ${event.claimIndex + 1}/${event.total}`
                  : "Extracting claims…",
                current: event.claimIndex,
                total: event.total,
              });
            } else if (event.type === "claim_result") {
              setStreamingClaims((prev) => [...prev, event.result]);
              setProgress((p) =>
                p
                  ? { ...p, phase: `Verifying claim ${event.result.id}…` }
                  : null
              );
            } else if (event.type === "complete") {
              setAuditResult(event.audit);
              setStreamingClaims([]);
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // ignore malformed SSE lines
          }
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

  const displayClaims = auditResult?.claims ?? streamingClaims;
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

        {/* Document textarea */}
        <div className="doc-textarea-wrapper">
          <label htmlFor="doc-input" className="doc-label">
            Document to Audit
          </label>
          <textarea
            id="doc-input"
            className="doc-textarea"
            placeholder="Paste any AI-generated document here… or click 'Load Sample Doc' above."
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>

        <AuditButton
          onClick={handleAudit}
          loading={loading}
          disabled={!canAudit}
          progress={progress}
        />

        {/* Error */}
        {error && (
          <motion.div
            className="error-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Streaming + Results */}
        <AnimatePresence>
          {(displayClaims.length > 0 || auditResult) && (
            <motion.div
              className="results-section"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Top row: trust score + verdict bar */}
              {auditResult && (
                <>
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

                  {/* Export */}
                  <div className="export-row">
                    <button
                      className="export-btn"
                      onClick={() =>
                        downloadFile(
                          generateMarkdownReport(text, auditResult),
                          `truthtrace-audit-${Date.now()}.md`,
                          "text/markdown"
                        )
                      }
                    >
                      <Download size={15} />
                      Download Markdown
                    </button>
                    <button
                      className="export-btn"
                      onClick={() =>
                        downloadFile(
                          generateJSONPayload(text, auditResult),
                          `truthtrace-audit-${Date.now()}.json`,
                          "application/json"
                        )
                      }
                    >
                      <FileJson size={15} />
                      Download JSON
                    </button>
                  </div>
                </>
              )}

              {/* Claim cards (show during streaming too) */}
              {displayClaims.length > 0 && (
                <div style={{ marginTop: auditResult ? 24 : 0 }}>
                  <ClaimCards claims={displayClaims} streaming={isStreaming} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

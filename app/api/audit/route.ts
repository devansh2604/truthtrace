import { NextRequest, NextResponse } from "next/server";
import { createGroqClient, extractClaims, analyseEvidence } from "@/lib/groq";
import { gatherEvidence } from "@/lib/evidence";
import { AuditResult, ClaimResult, StreamEvent } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

function sendEvent(controller: ReadableStreamDefaultController, event: StreamEvent) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

function computeStats(results: ClaimResult[]): AuditResult {
  const decided = results.filter((r) => r.userVerdict !== null);
  const verifiedCount = decided.filter((r) => r.userVerdict === "verified").length;
  const unverifiedCount = decided.filter((r) => r.userVerdict === "unverified").length;
  const hallucinatedCount = decided.filter((r) => r.userVerdict === "hallucinated").length;
  const pendingCount = results.filter((r) => r.userVerdict === null).length;

  // Trust score only from user verdicts
  // If no one has decided yet → 0
  const verifiedAvgScore =
    verifiedCount > 0
      ? decided
          .filter((r) => r.userVerdict === "verified")
          .reduce((s, r) => s + r.sourceScore, 0) / verifiedCount
      : 0;

  const trustScore =
    decided.length > 0
      ? Math.min(100, Math.max(0, Math.round((verifiedCount / results.length) * verifiedAvgScore)))
      : 0;

  return {
    claims: results,
    trustScore,
    totalClaims: results.length,
    decidedCount: decided.length,
    pendingCount,
    verifiedCount,
    unverifiedCount,
    hallucinatedCount,
  };
}

export async function POST(req: NextRequest) {
  let body: { text: string; apiKey: string; model: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { text, apiKey, model } = body;
  if (!text || !apiKey || !model)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (!apiKey.startsWith("gsk"))
    return NextResponse.json({ error: "Invalid Groq API key format" }, { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const groq = createGroqClient(apiKey);

        sendEvent(controller, { type: "claim_start", claimIndex: 0, total: 0, claim: "Extracting claims…" });

        const rawClaims = await extractClaims(groq, model, text);
        if (rawClaims.length === 0) {
          sendEvent(controller, { type: "error", message: "No claims could be extracted from the text." });
          controller.close();
          return;
        }

        const results: ClaimResult[] = [];
        const BATCH_SIZE = 2;

        for (let i = 0; i < rawClaims.length; i += BATCH_SIZE) {
          const batch = rawClaims.slice(i, i + BATCH_SIZE);

          sendEvent(controller, {
            type: "claim_start",
            claimIndex: i,
            total: rawClaims.length,
            claim: batch[0]?.claim || "",
          });

          const batchResults = await Promise.all(
            batch.map(async (rawClaim, batchIdx) => {
              const claimIdx = i + batchIdx;
              const { sources, evidenceText, totalSources } = await gatherEvidence(rawClaim.claim);
              const analysis = await analyseEvidence(groq, model, rawClaim.claim, evidenceText, totalSources);

              const enrichedSources = sources.map((src, si) => {
                const sentiment = analysis.sourceSentiments.find((s) => s.index === si + 1);
                return { ...src, supports: sentiment?.supports || ("neutral" as const) };
              });

              const result: ClaimResult = {
                id: `claim-${claimIdx}`,
                claim: rawClaim.claim,
                span: rawClaim.span || rawClaim.claim,
                type: rawClaim.type || "other",
                sourceScore: analysis.sourceScore,
                supportingCount: analysis.supportingCount,
                contradictingCount: analysis.contradictingCount,
                totalSources,
                reasoning: analysis.reasoning,
                supporting_quote: analysis.supporting_quote,
                sources: enrichedSources,
                userVerdict: null, // user decides — starts as pending
              };

              return result;
            })
          );

          for (const result of batchResults) {
            results.push(result);
            sendEvent(controller, { type: "claim_result", result });
          }
        }

        sendEvent(controller, { type: "complete", audit: computeStats(results) });
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        sendEvent(controller, { type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

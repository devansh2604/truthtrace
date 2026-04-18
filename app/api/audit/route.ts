import { NextRequest, NextResponse } from "next/server";
import { createGroqClient, extractClaims, verifyClaim } from "@/lib/groq";
import { gatherEvidence } from "@/lib/evidence";
import { AuditResult, ClaimResult, StreamEvent } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

function sendEvent(controller: ReadableStreamDefaultController, event: StreamEvent) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(req: NextRequest) {
  let body: { text: string; apiKey: string; model: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { text, apiKey, model } = body;
  if (!text || !apiKey || !model) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!apiKey.startsWith("gsk")) {
    return NextResponse.json({ error: "Invalid Groq API key format" }, { status: 400 });
  }

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
        const BATCH_SIZE = 2; // smaller batch — scraping is heavier

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

              // Gather evidence via scraping
              const { sources, evidenceText, totalSources } = await gatherEvidence(rawClaim.claim);

              // Verify with source counts
              const verification = await verifyClaim(
                groq, model, rawClaim.claim, evidenceText, totalSources
              );

              // Attach supports sentiment to each source
              const enrichedSources = sources.map((src, si) => {
                const sentiment = verification.sourceSentiments.find(
                  (s) => s.index === si + 1
                );
                return { ...src, supports: sentiment?.supports || "neutral" as const };
              });

              const result: ClaimResult = {
                id: `claim-${claimIdx}`,
                claim: rawClaim.claim,
                span: rawClaim.span || rawClaim.claim,
                type: rawClaim.type || "other",
                verdict: verification.verdict,
                confidence: verification.confidence,
                supportingCount: verification.supportingCount,
                contradictingCount: verification.contradictingCount,
                totalSources,
                reasoning: verification.reasoning,
                supporting_quote: verification.supporting_quote,
                sources: enrichedSources,
                userVerdict: null,
              };

              return result;
            })
          );

          for (const result of batchResults) {
            results.push(result);
            sendEvent(controller, { type: "claim_result", result });
          }
        }

        // Compute audit using AI verdicts (user overrides happen client-side)
        const verifiedCount = results.filter((r) => r.verdict === "verified").length;
        const hallucinatedCount = results.filter((r) => r.verdict === "hallucinated").length;
        const unverifiedCount = results.filter((r) => r.verdict === "unverified").length;

        const verifiedAvgConf =
          verifiedCount > 0
            ? results.filter((r) => r.verdict === "verified").reduce((s, r) => s + r.confidence, 0) / verifiedCount
            : 0;

        const trustScore = Math.min(100, Math.max(0, Math.round(
          results.length > 0 ? (verifiedCount / results.length) * verifiedAvgConf : 0
        )));

        const audit: AuditResult = {
          claims: results,
          trustScore,
          totalClaims: results.length,
          verifiedCount,
          unverifiedCount,
          hallucinatedCount,
        };

        sendEvent(controller, { type: "complete", audit });
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

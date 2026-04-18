import { NextRequest, NextResponse } from "next/server";
import { createGroqClient, extractClaims, verifyClaim } from "@/lib/groq";
import { gatherEvidence } from "@/lib/evidence";
import { AuditResult, ClaimResult, StreamEvent } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

function sendEvent(
  controller: ReadableStreamDefaultController,
  event: StreamEvent
) {
  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(encoder.encode(data));
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
    return NextResponse.json(
      { error: "Missing required fields: text, apiKey, model" },
      { status: 400 }
    );
  }

  if (!apiKey.startsWith("gsk_") && !apiKey.startsWith("gsk")) {
    return NextResponse.json(
      { error: "Invalid Groq API key format" },
      { status: 400 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const groq = createGroqClient(apiKey);

        // Step 1: Extract claims
        sendEvent(controller, {
          type: "claim_start",
          claimIndex: 0,
          total: 0,
          claim: "Extracting claims...",
        });

        const rawClaims = await extractClaims(groq, model, text);

        if (rawClaims.length === 0) {
          sendEvent(controller, {
            type: "error",
            message: "No claims could be extracted from the text.",
          });
          controller.close();
          return;
        }

        // Step 2 & 3: Evidence + Verification per claim (parallel batches)
        const results: ClaimResult[] = [];
        const BATCH_SIZE = 3;

        for (let i = 0; i < rawClaims.length; i += BATCH_SIZE) {
          const batch = rawClaims.slice(i, i + BATCH_SIZE);

          sendEvent(controller, {
            type: "claim_start",
            claimIndex: i,
            total: rawClaims.length,
            claim: batch[0]?.claim || "",
          });

          const batchPromises = batch.map(async (rawClaim, batchIdx) => {
            const claimIdx = i + batchIdx;
            const { sources, evidenceText } = await gatherEvidence(rawClaim.claim);
            const verification = await verifyClaim(
              groq,
              model,
              rawClaim.claim,
              evidenceText
            );

            const result: ClaimResult = {
              id: `claim-${claimIdx}`,
              claim: rawClaim.claim,
              span: rawClaim.span || rawClaim.claim,
              type: rawClaim.type || "other",
              verdict: verification.verdict,
              confidence: verification.confidence,
              reasoning: verification.reasoning,
              supporting_quote: verification.supporting_quote,
              sources,
            };

            return result;
          });

          const batchResults = await Promise.all(batchPromises);

          for (const result of batchResults) {
            results.push(result);
            sendEvent(controller, { type: "claim_result", result });
          }
        }

        // Step 4: Compute final audit
        const verifiedCount = results.filter((r) => r.verdict === "verified").length;
        const hallucinatedCount = results.filter(
          (r) => r.verdict === "hallucinated"
        ).length;
        const unverifiedCount = results.filter(
          (r) => r.verdict === "unverified"
        ).length;

        // Trust score: % of claims verified * avg confidence of verified claims
        // Penalises hallucinations heavily, rewards verified claims
        const verifiedAvgConf =
          verifiedCount > 0
            ? results
                .filter((r) => r.verdict === "verified")
                .reduce((s, r) => s + r.confidence, 0) / verifiedCount
            : 0;

        // Score = (verified/total) * verifiedAvgConf
        // e.g. 4 verified of 12 claims, avg 88% conf → (4/12)*88 = 29
        // All verified at 90% → 90. All hallucinated → 0.
        const rawScore =
          results.length > 0
            ? (verifiedCount / results.length) * verifiedAvgConf
            : 0;

        const audit: AuditResult = {
          claims: results,
          trustScore: Math.min(100, Math.max(0, Math.round(rawScore))),
          totalClaims: results.length,
          verifiedCount,
          unverifiedCount,
          hallucinatedCount,
        };

        sendEvent(controller, { type: "complete", audit });
        controller.close();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
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

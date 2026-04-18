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

        // Trust score: weighted average of confidences
        // verified=full confidence, unverified=partial, hallucinated=0
        const trustScore = Math.round(
          results.reduce((acc, r) => {
            if (r.verdict === "verified") return acc + r.confidence;
            if (r.verdict === "unverified") return acc + r.confidence * 0.4;
            return acc; // hallucinated = 0
          }, 0) / Math.max(results.length, 1)
        );

        const audit: AuditResult = {
          claims: results,
          trustScore: Math.min(100, Math.max(0, trustScore)),
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

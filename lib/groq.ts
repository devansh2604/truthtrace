import Groq from "groq-sdk";
import { RawClaim, Verdict } from "./types";

export function createGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey, dangerouslyAllowBrowser: false });
}

export async function extractClaims(
  client: Groq,
  model: string,
  text: string
): Promise<RawClaim[]> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a meticulous fact-checker. Extract every distinct, verifiable factual claim from the provided text.
Return ONLY a valid JSON array (no markdown, no extra text). Each element must be:
{
  "claim": "<the factual assertion as a standalone sentence>",
  "span": "<the exact substring from the original text that contains this claim>",
  "type": "<one of: date, person, statistic, location, event, organization, measurement, other>"
}
Rules:
- Each claim must be atomic (one fact per claim).
- The span must be an exact substring of the original text.
- Include ALL verifiable claims, including dates, names, numbers, attributions, and events.
- Do NOT include opinions or subjective statements.`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const content = completion.choices[0]?.message?.content || "[]";
  // Strip markdown code fences if present
  const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try to extract JSON array from text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}

export async function verifyClaim(
  client: Groq,
  model: string,
  claim: string,
  evidence: string
): Promise<{
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  supporting_quote: string;
}> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a rigorous fact-checker. Given a claim and evidence from Wikipedia and the web, determine if the claim is accurate.

Return ONLY a valid JSON object (no markdown):
{
  "verdict": "<verified|unverified|hallucinated>",
  "confidence": <integer 0-100>,
  "reasoning": "<1-2 sentence explanation>",
  "supporting_quote": "<relevant quote from the evidence, or empty string>"
}

Definitions:
- verified: The claim is confirmed by the evidence with high confidence.
- unverified: The evidence neither confirms nor contradicts the claim (insufficient info).
- hallucinated: The claim directly contradicts the evidence, or makes specific attributions (names, papers, institutions) that cannot be verified and appear fabricated.

Be strict: invented academic papers, fake researchers, wrong statistics = hallucinated.`,
      },
      {
        role: "user",
        content: `CLAIM: ${claim}\n\nEVIDENCE:\n${evidence}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 512,
  });

  const content = completion.choices[0]?.message?.content || "{}";
  const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      verdict: ["verified", "unverified", "hallucinated"].includes(parsed.verdict)
        ? parsed.verdict
        : "unverified",
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      reasoning: parsed.reasoning || "Unable to determine.",
      supporting_quote: parsed.supporting_quote || "",
    };
  } catch {
    return {
      verdict: "unverified",
      confidence: 50,
      reasoning: "Could not parse verification response.",
      supporting_quote: "",
    };
  }
}

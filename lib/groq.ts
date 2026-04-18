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

Return ONLY a raw JSON object — no markdown fences, no extra text, just the JSON:
{
  "verdict": "verified" | "unverified" | "hallucinated",
  "confidence": <integer between 0 and 100>,
  "reasoning": "<1-2 sentence explanation>",
  "supporting_quote": "<short relevant quote from the evidence, or empty string if none>"
}

Verdict definitions:
- "verified": Evidence directly supports the claim. Confidence should reflect how strongly (e.g. 85-95 for clear matches, not always 100).
- "unverified": Evidence is absent or inconclusive. Confidence should be 40-65.
- "hallucinated": Claim contradicts evidence OR contains specific invented details (fake names, fake papers, fake institutions, wrong numbers). Confidence 70-95.

IMPORTANT: Do NOT return 100 for everything. Be calibrated — very few things deserve 100%.`,
      },
      {
        role: "user",
        content: `CLAIM: ${claim}\n\nEVIDENCE:\n${evidence}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 512,
  });

  const content = completion.choices[0]?.message?.content || "{}";
  // Strip any markdown fences the model might add despite instructions
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    // Handle confidence as either number or string (e.g. "85" or 85 or "85%")
    const rawConf = parsed.confidence;
    const confidence = Math.min(
      100,
      Math.max(
        0,
        typeof rawConf === "number"
          ? Math.round(rawConf)
          : parseInt(String(rawConf), 10) || 50
      )
    );
    return {
      verdict: ["verified", "unverified", "hallucinated"].includes(parsed.verdict)
        ? (parsed.verdict as Verdict)
        : "unverified",
      confidence,
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

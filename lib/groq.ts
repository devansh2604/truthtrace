import Groq from "groq-sdk";
import { RawClaim, Verdict, ScrapedSource } from "./types";

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
- Include ALL verifiable claims: dates, names, numbers, attributions, events.
- Do NOT include opinions or subjective statements.`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const content = completion.choices[0]?.message?.content || "[]";
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return []; }
    }
    return [];
  }
}

export async function verifyClaim(
  client: Groq,
  model: string,
  claim: string,
  evidenceText: string,
  totalSources: number
): Promise<{
  verdict: Verdict;
  confidence: number;
  supportingCount: number;
  contradictingCount: number;
  reasoning: string;
  supporting_quote: string;
  sourceSentiments: Array<{ index: number; supports: "yes" | "no" | "neutral" }>;
}> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a rigorous fact-checker with access to ${totalSources} web sources.

Analyze the claim against ALL provided sources. Return ONLY raw JSON (no markdown):
{
  "verdict": "verified" | "unverified" | "hallucinated",
  "supporting_count": <integer - how many sources support the claim>,
  "contradicting_count": <integer - how many sources contradict or cast doubt>,
  "reasoning": "<2-3 sentence summary of what the evidence shows>",
  "supporting_quote": "<best quote from any source supporting or clarifying the claim>",
  "source_sentiments": [
    {"index": 1, "supports": "yes" | "no" | "neutral"},
    ...one entry per source...
  ]
}

Verdict rules:
- "verified": Majority of sources (>50%) confirm the claim clearly.
- "hallucinated": Claim directly contradicts evidence, OR contains invented names/papers/institutions not found in any source.
- "unverified": Sources are inconclusive, mixed, or absent.

supporting_count + contradicting_count should add up to the number of sources that took a clear position.
Be precise with the counts. Do NOT inflate supporting_count.`,
      },
      {
        role: "user",
        content: `CLAIM: ${claim}\n\nEVIDENCE FROM ${totalSources} SOURCES:\n${evidenceText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  });

  const content = completion.choices[0]?.message?.content || "{}";
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    const p = JSON.parse(cleaned);
    const supporting = Math.max(0, parseInt(p.supporting_count) || 0);
    const contradicting = Math.max(0, parseInt(p.contradicting_count) || 0);
    const total = Math.max(supporting + contradicting, 1);
    // Confidence = % of opinionated sources that support
    const confidence = Math.round((supporting / total) * 100);

    return {
      verdict: ["verified", "unverified", "hallucinated"].includes(p.verdict)
        ? (p.verdict as Verdict)
        : "unverified",
      confidence,
      supportingCount: supporting,
      contradictingCount: contradicting,
      reasoning: p.reasoning || "Unable to determine.",
      supporting_quote: p.supporting_quote || "",
      sourceSentiments: Array.isArray(p.source_sentiments) ? p.source_sentiments : [],
    };
  } catch {
    return {
      verdict: "unverified",
      confidence: 50,
      supportingCount: 0,
      contradictingCount: 0,
      reasoning: "Could not parse verification response.",
      supporting_quote: "",
      sourceSentiments: [],
    };
  }
}

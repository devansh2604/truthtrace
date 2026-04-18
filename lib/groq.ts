import Groq from "groq-sdk";
import { RawClaim, ScrapedSource } from "./types";

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
    if (match) { try { return JSON.parse(match[0]); } catch { return []; } }
    return [];
  }
}

// AI only analyses evidence and returns a score — NO verdict label
export async function analyseEvidence(
  client: Groq,
  model: string,
  claim: string,
  evidenceText: string,
  totalSources: number
): Promise<{
  sourceScore: number;
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
        content: `You are a neutral evidence analyst. You do NOT decide if a claim is true or false — that is for the human to decide. Your job is only to:
1. Count how many of the ${totalSources} sources support the claim vs contradict it
2. Summarise what the evidence shows
3. Pick the best supporting quote

Return ONLY raw JSON (no markdown):
{
  "supporting_count": <integer>,
  "contradicting_count": <integer>,
  "reasoning": "<2-3 sentence neutral summary of what the evidence shows — do NOT say verified/hallucinated/true/false>",
  "supporting_quote": "<best quote from any source, or empty string>",
  "source_sentiments": [
    {"index": 1, "supports": "yes" | "no" | "neutral"},
    ...one entry per source...
  ]
}

Be precise. Do NOT pass any judgment. Just report what the sources say.`,
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
    const sourceScore = Math.round((supporting / total) * 100);

    return {
      sourceScore,
      supportingCount: supporting,
      contradictingCount: contradicting,
      reasoning: p.reasoning || "No summary available.",
      supporting_quote: p.supporting_quote || "",
      sourceSentiments: Array.isArray(p.source_sentiments) ? p.source_sentiments : [],
    };
  } catch {
    return {
      sourceScore: 50,
      supportingCount: 0,
      contradictingCount: 0,
      reasoning: "Could not analyse evidence.",
      supporting_quote: "",
      sourceSentiments: [],
    };
  }
}

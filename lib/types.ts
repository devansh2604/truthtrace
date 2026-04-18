export type Verdict = "verified" | "unverified" | "hallucinated";

export interface RawClaim {
  claim: string;
  span: string;
  type: string;
}

export interface ScrapedSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  source: "wikipedia" | "web";
  supports: "yes" | "no" | "neutral"; // filled after LLM analysis
}

export interface ClaimResult {
  id: string;
  claim: string;
  span: string;
  type: string;
  // AI verdict
  verdict: Verdict;
  confidence: number; // source-based: % of sources supporting
  supportingCount: number;
  contradictingCount: number;
  totalSources: number;
  reasoning: string;
  supporting_quote: string;
  sources: ScrapedSource[];
  // User override
  userVerdict: Verdict | null; // null = user hasn't overridden
}

export interface AuditResult {
  claims: ClaimResult[];
  trustScore: number;
  totalClaims: number;
  verifiedCount: number;
  unverifiedCount: number;
  hallucinatedCount: number;
}

export interface AuditRequest {
  text: string;
  apiKey: string;
  model: string;
}

export type StreamEvent =
  | { type: "claim_start"; claimIndex: number; total: number; claim: string }
  | { type: "claim_result"; result: ClaimResult }
  | { type: "complete"; audit: AuditResult }
  | { type: "error"; message: string };

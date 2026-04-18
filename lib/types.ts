export type Verdict = "verified" | "unverified" | "hallucinated";

export interface RawClaim {
  claim: string;
  span: string;
  type: string;
}

export interface EvidenceSource {
  title: string;
  url: string;
  snippet: string;
  source: "wikipedia" | "duckduckgo";
}

export interface ClaimResult {
  id: string;
  claim: string;
  span: string;
  type: string;
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  supporting_quote: string;
  sources: EvidenceSource[];
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

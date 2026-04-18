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
  supports: "yes" | "no" | "neutral";
}

export interface ClaimResult {
  id: string;
  claim: string;
  span: string;
  type: string;
  // Evidence score only — AI does NOT decide verdict
  sourceScore: number;       // % of sources that support (0-100)
  supportingCount: number;
  contradictingCount: number;
  totalSources: number;
  reasoning: string;         // summary of what evidence shows
  supporting_quote: string;
  sources: ScrapedSource[];
  // Only the user decides
  userVerdict: Verdict | null; // null = pending, user hasn't decided yet
}

export interface AuditResult {
  claims: ClaimResult[];
  trustScore: number;        // calculated from user verdicts only
  totalClaims: number;
  decidedCount: number;      // how many user has labelled
  pendingCount: number;      // how many still pending
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

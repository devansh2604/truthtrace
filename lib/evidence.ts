import { EvidenceSource } from "./types";

// Sanitize query for Wikipedia lookup
function wikiQuery(claim: string): string {
  // Extract the most meaningful noun phrase (first ~5 words)
  return claim
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")
    .trim();
}

export async function fetchWikipedia(claim: string): Promise<EvidenceSource | null> {
  const query = wikiQuery(claim);
  const encoded = encodeURIComponent(query);

  try {
    // First try direct summary
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { "User-Agent": "TruthTrace/1.0 (hallucination-auditor)" } }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.extract) {
        return {
          title: data.title,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
          snippet: data.extract.slice(0, 600),
          source: "wikipedia",
        };
      }
    }

    // Fallback: search Wikipedia
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&origin=*&srlimit=1`,
      { headers: { "User-Agent": "TruthTrace/1.0" } }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const firstResult = searchData?.query?.search?.[0];
      if (firstResult) {
        const title = encodeURIComponent(firstResult.title);
        const summaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
          { headers: { "User-Agent": "TruthTrace/1.0" } }
        );
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          if (summaryData.extract) {
            return {
              title: summaryData.title,
              url:
                summaryData.content_urls?.desktop?.page ||
                `https://en.wikipedia.org/wiki/${title}`,
              snippet: summaryData.extract.slice(0, 600),
              source: "wikipedia",
            };
          }
        }
      }
    }
  } catch {
    // silently fail
  }
  return null;
}

export async function fetchDuckDuckGo(claim: string): Promise<EvidenceSource[]> {
  try {
    // Use DuckDuckGo instant answer API (free, no key)
    const query = encodeURIComponent(claim.slice(0, 100));
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${query}&format=json&no_redirect=1&no_html=1&skip_disambig=1`,
      { headers: { "User-Agent": "TruthTrace/1.0" } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const sources: EvidenceSource[] = [];

    // Abstract
    if (data.Abstract && data.AbstractURL) {
      sources.push({
        title: data.Heading || "DuckDuckGo Result",
        url: data.AbstractURL,
        snippet: data.Abstract.slice(0, 400),
        source: "duckduckgo",
      });
    }

    // Related topics
    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 2)) {
        if (topic.Text && topic.FirstURL) {
          sources.push({
            title: topic.Text.slice(0, 80),
            url: topic.FirstURL,
            snippet: topic.Text.slice(0, 300),
            source: "duckduckgo",
          });
        }
      }
    }

    return sources.slice(0, 3);
  } catch {
    return [];
  }
}

export async function gatherEvidence(claim: string): Promise<{
  sources: EvidenceSource[];
  evidenceText: string;
}> {
  const [wikiResult, ddgResults] = await Promise.all([
    fetchWikipedia(claim),
    fetchDuckDuckGo(claim),
  ]);

  const sources: EvidenceSource[] = [];
  const evidenceParts: string[] = [];

  if (wikiResult) {
    sources.push(wikiResult);
    evidenceParts.push(`[Wikipedia - ${wikiResult.title}]\n${wikiResult.snippet}`);
  }

  for (const ddg of ddgResults) {
    sources.push(ddg);
    evidenceParts.push(`[Web - ${ddg.title}]\n${ddg.snippet}`);
  }

  const evidenceText =
    evidenceParts.length > 0
      ? evidenceParts.join("\n\n")
      : "No direct evidence found for this claim. The claim may involve obscure or unverifiable information.";

  return { sources, evidenceText };
}

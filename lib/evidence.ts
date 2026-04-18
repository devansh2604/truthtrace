import { ScrapedSource } from "./types";

const UA = "Mozilla/5.0 (compatible; TruthTrace/1.0; +https://truthtrace.vercel.app)";

// ── Wikipedia REST API ────────────────────────────────────────────────────────
async function scrapeWikipedia(query: string): Promise<ScrapedSource[]> {
  const sources: ScrapedSource[] = [];
  try {
    // Try direct page summary first
    const encoded = encodeURIComponent(query.split(/\s+/).slice(0, 6).join(" "));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.extract) {
        sources.push({
          title: data.title,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
          domain: "en.wikipedia.org",
          snippet: data.extract.slice(0, 600),
          source: "wikipedia",
          supports: "neutral",
        });
      }
    }

    // Also search Wikipedia for up to 3 related pages
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&origin=*&srlimit=3`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const results = searchData?.query?.search || [];
      for (const r of results.slice(0, 3)) {
        if (sources.some((s) => s.title === r.title)) continue;
        // Strip HTML from snippet
        const snippet = (r.snippet || "").replace(/<[^>]+>/g, "").slice(0, 400);
        sources.push({
          title: r.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
          domain: "en.wikipedia.org",
          snippet,
          source: "wikipedia",
          supports: "neutral",
        });
      }
    }
  } catch { /* silent fail */ }
  return sources;
}

// ── DuckDuckGo Instant Answer JSON API (free, no key) ────────────────────────
async function scrapeDDGInstant(query: string): Promise<ScrapedSource[]> {
  const sources: ScrapedSource[] = [];
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return sources;
    const data = await res.json();

    // Abstract (main answer)
    if (data.Abstract) {
      sources.push({
        title: data.Heading || query,
        url: data.AbstractURL || data.AbstractSource || "",
        domain: data.AbstractSource || "duckduckgo.com",
        snippet: data.Abstract.slice(0, 500),
        source: "web",
        supports: "neutral",
      });
    }

    // Related topics
    const topics: Array<{ Text?: string; FirstURL?: string }> = data.RelatedTopics || [];
    for (const topic of topics.slice(0, 8)) {
      if (!topic.Text) continue;
      let domain = "duckduckgo.com";
      try { domain = new URL(topic.FirstURL || "").hostname.replace("www.", ""); } catch { /**/ }
      sources.push({
        title: topic.Text.slice(0, 80),
        url: topic.FirstURL || "",
        domain,
        snippet: topic.Text.slice(0, 400),
        source: "web",
        supports: "neutral",
      });
    }

    // Infobox facts
    const infobox: Array<{ label?: string; value?: string }> = data.Infobox?.content || [];
    if (infobox.length > 0) {
      const facts = infobox
        .filter((f) => f.label && f.value)
        .map((f) => `${f.label}: ${f.value}`)
        .join(" | ")
        .slice(0, 400);
      if (facts) {
        sources.push({
          title: `${data.Heading || query} — Infobox`,
          url: data.AbstractURL || "",
          domain: "duckduckgo.com",
          snippet: facts,
          source: "web",
          supports: "neutral",
        });
      }
    }
  } catch { /* silent fail */ }
  return sources;
}

// ── DuckDuckGo search results via their open API ──────────────────────────────
async function scrapeDDGSearch(query: string): Promise<ScrapedSource[]> {
  const sources: ScrapedSource[] = [];
  try {
    // DDG search suggestions give us related queries we can mine
    const url = `https://ac.duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return sources;
    const data = await res.json();
    // Returns [query, [suggestions]]
    const suggestions: string[] = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];

    // For each related suggestion, hit DDG instant answer again
    const subResults = await Promise.all(
      suggestions.slice(0, 4).map((s) => scrapeDDGInstant(s))
    );
    for (const sub of subResults) sources.push(...sub.slice(0, 2));
  } catch { /* silent fail */ }
  return sources;
}

// ── Fetch real webpage text ───────────────────────────────────────────────────
async function fetchPageText(url: string): Promise<string> {
  if (!url || !url.startsWith("http")) return "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return "";
    const html = await res.text();
    // Simple text extraction — remove tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 800);
  } catch {
    return "";
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function gatherEvidence(claim: string): Promise<{
  sources: ScrapedSource[];
  evidenceText: string;
  totalSources: number;
}> {
  // Run Wikipedia + DDG instant + DDG search in parallel
  const [wikiSources, ddgInstant, ddgSearch] = await Promise.all([
    scrapeWikipedia(claim),
    scrapeDDGInstant(claim),
    scrapeDDGSearch(claim),
  ]);

  // Deduplicate by snippet content
  const seen = new Set<string>();
  const all: ScrapedSource[] = [];
  for (const src of [...wikiSources, ...ddgInstant, ...ddgSearch]) {
    const key = src.snippet.slice(0, 60);
    if (!seen.has(key) && src.snippet.length > 20) {
      seen.add(key);
      all.push(src);
    }
  }

  // Fetch real page text for top non-Wikipedia web sources to enrich snippets
  const webSources = all.filter((s) => s.source === "web" && s.url.startsWith("http")).slice(0, 5);
  const pageTexts = await Promise.all(webSources.map((s) => fetchPageText(s.url)));
  pageTexts.forEach((text, i) => {
    if (text && text.length > 100) webSources[i].snippet = text.slice(0, 400);
  });

  const final = all.slice(0, 15);

  const evidenceText =
    final.length > 0
      ? final.map((s, i) => `[Source ${i + 1}: ${s.domain}]\nTitle: ${s.title}\n${s.snippet}`).join("\n\n---\n\n")
      : "No evidence found for this claim.";

  return { sources: final, evidenceText, totalSources: final.length };
}

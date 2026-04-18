import { parse } from "node-html-parser";
import { ScrapedSource } from "./types";

const UA = "Mozilla/5.0 (compatible; TruthTrace/1.0; +https://truthtrace.vercel.app)";

// ── DuckDuckGo HTML search → scrape result snippets ──────────────────────────
async function scrapeDDGSearch(query: string): Promise<ScrapedSource[]> {
  const sources: ScrapedSource[] = [];
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return sources;

    const html = await res.text();
    const root = parse(html);

    const results = root.querySelectorAll(".result");
    for (const result of results.slice(0, 12)) {
      const titleEl = result.querySelector(".result__title a");
      const snippetEl = result.querySelector(".result__snippet");
      const urlEl = result.querySelector(".result__url");

      const title = titleEl?.text?.trim() || "";
      const snippet = snippetEl?.text?.trim() || "";
      const rawUrl = titleEl?.getAttribute("href") || urlEl?.text?.trim() || "";

      if (!snippet || !title) continue;

      // Extract real URL from DDG redirect
      let domain = "";
      try {
        const urlStr = rawUrl.includes("uddg=")
          ? decodeURIComponent(rawUrl.split("uddg=")[1].split("&")[0])
          : rawUrl;
        domain = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`).hostname.replace("www.", "");
      } catch {
        domain = rawUrl.slice(0, 30);
      }

      sources.push({
        title: title.slice(0, 100),
        url: rawUrl,
        domain,
        snippet: snippet.slice(0, 400),
        source: "web",
        supports: "neutral",
      });
    }
  } catch {
    // silently fail
  }
  return sources;
}

// ── Wikipedia REST API ────────────────────────────────────────────────────────
async function scrapeWikipedia(query: string): Promise<ScrapedSource | null> {
  try {
    const encoded = encodeURIComponent(
      query.split(/\s+/).slice(0, 6).join(" ")
    );
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) {
      // try search fallback
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&origin=*&srlimit=1`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) }
      );
      if (!searchRes.ok) return null;
      const searchData = await searchRes.json();
      const first = searchData?.query?.search?.[0];
      if (!first) return null;
      const title = encodeURIComponent(first.title);
      const s2 = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) }
      );
      if (!s2.ok) return null;
      const d2 = await s2.json();
      if (!d2.extract) return null;
      return {
        title: d2.title,
        url: d2.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${title}`,
        domain: "en.wikipedia.org",
        snippet: d2.extract.slice(0, 600),
        source: "wikipedia",
        supports: "neutral",
      };
    }
    const data = await res.json();
    if (!data.extract) return null;
    return {
      title: data.title,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
      domain: "en.wikipedia.org",
      snippet: data.extract.slice(0, 600),
      source: "wikipedia",
      supports: "neutral",
    };
  } catch {
    return null;
  }
}

// ── Fetch & extract text from a real webpage ──────────────────────────────────
async function fetchPageText(url: string): Promise<string> {
  try {
    // Only fetch plain web pages, skip PDFs, videos etc.
    if (!url.startsWith("http")) return "";
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return "";
    const html = await res.text();
    const root = parse(html);
    // Remove scripts, styles, nav etc.
    root.querySelectorAll("script,style,nav,footer,header,aside").forEach((el) => el.remove());
    const text = root.querySelector("main, article, .content, body")?.text || root.text;
    return text.replace(/\s+/g, " ").trim().slice(0, 800);
  } catch {
    return "";
  }
}

// ── Main gather function ──────────────────────────────────────────────────────
export async function gatherEvidence(claim: string): Promise<{
  sources: ScrapedSource[];
  evidenceText: string;
  totalSources: number;
}> {
  // Run Wikipedia + DDG search in parallel
  const [wikiResult, ddgSources] = await Promise.all([
    scrapeWikipedia(claim),
    scrapeDDGSearch(claim),
  ]);

  const sources: ScrapedSource[] = [];
  if (wikiResult) sources.push(wikiResult);
  sources.push(...ddgSources);

  // Fetch actual page text for top 5 web sources to enrich snippets
  const webSources = sources.filter((s) => s.source === "web").slice(0, 5);
  const pageTexts = await Promise.all(
    webSources.map((s) => fetchPageText(s.url))
  );
  pageTexts.forEach((text, i) => {
    if (text && text.length > 100) {
      webSources[i].snippet = text.slice(0, 400);
    }
  });

  // Build evidence text for LLM
  const evidenceParts = sources.slice(0, 15).map((s, i) =>
    `[Source ${i + 1}: ${s.domain}]\nTitle: ${s.title}\n${s.snippet}`
  );

  const evidenceText =
    evidenceParts.length > 0
      ? evidenceParts.join("\n\n---\n\n")
      : "No evidence found for this claim.";

  return {
    sources: sources.slice(0, 15),
    evidenceText,
    totalSources: sources.length,
  };
}

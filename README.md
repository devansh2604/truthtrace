# TruthTrace — AI Hallucination Auditor

> **Every claim. Every source. Every time.**

TruthTrace extracts every factual claim from AI-generated text, verifies each one against Wikipedia and live web sources using Groq LLMs, and returns a color-coded audit with a 0–100 trust score — streamed live as results arrive.

![TruthTrace Screenshot](./public/screenshot.png)

## ✨ Features

- **Live SSE Streaming** — results appear one-by-one as each claim is verified
- **Claim Extraction** — Llama 3.3 70B identifies every atomic, verifiable fact
- **Evidence Gathering** — Wikipedia REST API + DuckDuckGo per claim
- **LLM-as-Judge** — second Groq call delivers `verified` / `unverified` / `hallucinated` verdict + confidence %
- **Trust Score Ring** — 0–100 Recharts radial gauge, color-shifts red → amber → green
- **Annotated Document** — inline highlights with hover tooltips showing reasoning
- **Filter Tabs** — filter claims by verdict
- **Export** — Download Markdown report or full JSON payload

## 🚀 Quick Start

### 1. Get a free Groq API key

Sign up at [console.groq.com](https://console.groq.com) — no credit card needed.

### 2. Clone & install

```bash
git clone <repo-url>
cd truthtrace
npm install
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste your Groq key, and click **Run Audit**.

> Your API key is **never stored** — it's sent directly to your own Groq account per request only.

## 🏗️ Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 App Router + TypeScript |
| Styling | Tailwind CSS v4 + custom CSS design system |
| Animation | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |
| LLM | Groq SDK (Llama 3.3 70B) |
| Evidence | Wikipedia REST API + DuckDuckGo Instant Answer API |
| Deploy | Vercel (free hobby tier) |

## 📁 File Structure

```
truthtrace/
├── app/
│   ├── layout.tsx          # Root layout + fonts
│   ├── page.tsx            # Main single-page experience
│   ├── globals.css         # Full design system (tokens, keyframes, components)
│   └── api/audit/route.ts  # POST → SSE streaming pipeline
├── components/
│   ├── hero.tsx
│   ├── config-card.tsx
│   ├── audit-button.tsx
│   └── results/
│       ├── trust-score-ring.tsx
│       ├── metric-cards.tsx
│       ├── verdict-bar.tsx
│       ├── annotated-doc.tsx
│       └── claim-cards.tsx
├── lib/
│   ├── types.ts
│   ├── groq.ts
│   ├── evidence.ts
│   ├── export.ts
│   └── constants.ts
└── hooks/
    └── use-counter.ts
```

## 🌐 Deploy to Vercel

```bash
npx vercel --prod
```

No environment variables needed — API key is provided by user at runtime via the UI.

## 📄 License

MIT

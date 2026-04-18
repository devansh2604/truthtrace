import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TruthTrace — AI Hallucination Auditor",
  description:
    "Paste any AI-generated document and get a live, source-backed hallucination audit in seconds. Every claim verified against Wikipedia and live web sources.",
  keywords: [
    "AI hallucination detector",
    "fact checker",
    "claim verification",
    "LLM audit",
    "Groq",
    "Wikipedia verification",
  ],
  openGraph: {
    title: "TruthTrace — AI Hallucination Auditor",
    description:
      "Real-time AI hallucination detection. Every claim, every source, every time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

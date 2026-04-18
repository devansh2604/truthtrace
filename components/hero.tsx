"use client";
import { motion } from "framer-motion";

const badges = [
  "Real-time Verification",
  "Wikipedia + Live Web",
  "LLM-as-Judge",
  "Trust Scoring",
];

export function Hero() {
  return (
    <div className="hero-wrapper">
      <div className="hero-bg" />
      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          className="hero-logo"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 3L29 10V22L16 29L3 22V10L16 3Z"
                stroke="url(#grad)"
                strokeWidth="2"
                fill="none"
              />
              <circle cx="16" cy="16" r="4" fill="url(#grad)" />
              <path d="M16 8V12M16 20V24M8 16H12M20 16H24" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="grad" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#667eea" />
                  <stop offset="0.5" stopColor="#764ba2" />
                  <stop offset="1" stopColor="#f093fb" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-text">TruthTrace</span>
        </motion.div>

        <motion.h1
          className="hero-headline"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          The AI{" "}
          <span className="gradient-text">Hallucination</span>
          <br />
          Auditor
        </motion.h1>

        <motion.p
          className="hero-sub"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          Every claim. Every source. Every time.
          <br />
          Paste any AI-generated text and get a live, source-backed audit in seconds.
        </motion.p>

        <motion.div
          className="hero-badges"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {badges.map((badge, i) => (
            <motion.span
              key={badge}
              className="badge-chip"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.08 }}
            >
              {badge}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

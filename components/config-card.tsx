"use client";
import { useState } from "react";
import { Eye, EyeOff, Zap, ChevronDown } from "lucide-react";
import { GROQ_MODELS } from "@/lib/constants";
import { motion } from "framer-motion";

interface ConfigCardProps {
  apiKey: string;
  setApiKey: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  onLoadSample: () => void;
}

export function ConfigCard({
  apiKey,
  setApiKey,
  model,
  setModel,
  onLoadSample,
}: ConfigCardProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <motion.div
      className="config-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <div className="config-header">
        <div className="config-title">
          <Zap size={16} className="accent-icon" />
          <span>Configuration</span>
        </div>
        <button className="load-sample-btn" onClick={onLoadSample}>
          Load Sample Doc
        </button>
      </div>

      <div className="config-fields">
        {/* API Key */}
        <div className="field-group">
          <label className="field-label" htmlFor="api-key">
            Groq API Key
            <span className="field-hint">
              Get one free at{" "}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                console.groq.com
              </a>
            </span>
          </label>
          <div className="key-input-wrapper">
            <input
              id="api-key"
              type={showKey ? "text" : "password"}
              className="key-input"
              placeholder="gsk_xxxx…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="key-toggle"
              onClick={() => setShowKey((p) => !p)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Model Selector */}
        <div className="field-group">
          <label className="field-label" htmlFor="model-select">
            Model
          </label>
          <div className="select-wrapper">
            <select
              id="model-select"
              className="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {GROQ_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>
        </div>
      </div>

      <p className="config-privacy">
        🔒 Your API key is sent only to your own Groq account and never stored on our servers.
      </p>
    </motion.div>
  );
}

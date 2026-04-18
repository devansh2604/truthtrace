"use client";
import { motion } from "framer-motion";
import { Search, Loader2 } from "lucide-react";

interface AuditButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  progress?: { phase: string; current: number; total: number } | null;
}

export function AuditButton({
  onClick,
  loading,
  disabled,
  progress,
}: AuditButtonProps) {
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : loading
      ? 15
      : 0;

  return (
    <div className="audit-btn-wrapper">
      <motion.button
        id="audit-button"
        className={`audit-btn ${loading ? "loading" : ""}`}
        onClick={onClick}
        disabled={disabled || loading}
        whileTap={{ scale: 0.98 }}
        whileHover={!loading && !disabled ? { scale: 1.01 } : {}}
      >
        {loading ? (
          <span className="btn-content">
            <Loader2 size={18} className="spin" />
            <span>
              {progress
                ? progress.total > 0
                  ? `Verifying claim ${progress.current}/${progress.total}…`
                  : progress.phase
                : "Extracting claims…"}
            </span>
          </span>
        ) : (
          <span className="btn-content">
            <Search size={18} />
            <span>Run Audit</span>
          </span>
        )}
        <span className="btn-shimmer" />
      </motion.button>

      {loading && (
        <div className="progress-track">
          <motion.div
            className="progress-fill"
            initial={{ width: "5%" }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
      )}
    </div>
  );
}

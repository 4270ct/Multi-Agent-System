import { motion, AnimatePresence } from "motion/react";
import Icon from "./Icon.jsx";
import { label } from "./common.jsx";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(ts) {
  const s = Math.round((ts - Date.now()) / 1000);
  const steps = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, secs] of steps) {
    if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  }
  return "just now";
}

const tone = (status) =>
  status === "error" || status === "blocked_security" ? "chip-warn" : status === "running" ? "" : "chip-ok";

export default function HistoryPanel({ items, onSelect, onRemove, onClear, disabled, ready = true }) {
  if (!items.length) return null;
  return (
    <motion.section
      className="card history"
      initial={{ opacity: 0, y: 16 }}
      animate={ready ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay: 0.5 }}
      aria-label="Search history"
    >
      <div className="card-head">
        <h2><Icon name="history" size={18} /> Recent searches</h2>
        <button className="btn-link" onClick={onClear}>Clear all</button>
      </div>
      <ul className="history-list">
        <AnimatePresence initial={false}>
          {items.map((h) => (
            <motion.li
              key={h.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
            >
              <button className="history-item" disabled={disabled} onClick={() => onSelect(h.text)}>
                <span className="history-text">{h.text}</span>
                <span className="history-meta">
                  <small>{ago(h.at)}</small>
                  {h.status && <span className={`chip ${tone(h.status)}`}>{label(h.status)}</span>}
                </span>
              </button>
              <button className="icon-btn" aria-label={`Remove "${h.text}" from history`} onClick={() => onRemove(h.id)}>
                <Icon name="x" size={16} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

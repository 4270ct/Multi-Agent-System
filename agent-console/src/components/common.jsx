import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Icon from "./Icon.jsx";

export const label = (key) => {
  const s = String(key).replace(/_/g, " ").replace(/\bpct\b/i, "%").replace(/\busd\b/i, "(USD)");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const asText = (v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

export function Notice({ kind = "info", children }) {
  if (!children) return null;
  return (
    <motion.div
      className={`notice notice-${kind}`}
      role={kind === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Icon name={kind === "error" ? "alert" : "check"} size={18} />
      <span>{children}</span>
    </motion.div>
  );
}

export function Disclosure({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="disclosure">
      <button
        className="disclosure-head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Icon name="chevron" size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="disclosure-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Renders any JSON value as readable key/value rows. */
export function DataView({ data }) {
  if (data === null || data === undefined || data === "") {
    return <p className="muted">Nothing stored yet.</p>;
  }
  if (typeof data !== "object") return <pre className="pre">{asText(data)}</pre>;
  if (Array.isArray(data)) {
    if (!data.length) return <p className="muted">Nothing stored yet.</p>;
    return (
      <ul className="data-list">
        {data.map((item, i) => (
          <li key={i}>
            <DataView data={item} />
          </li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(data);
  if (!entries.length) return <p className="muted">Nothing stored yet.</p>;
  return (
    <dl className="kv">
      {entries.map(([k, v]) => (
        <div className="kv-row" key={k}>
          <dt>{label(k)}</dt>
          <dd>{typeof v === "object" && v !== null ? <DataView data={v} /> : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({ title, children }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { DataView, Notice, PageHeader, label } from "./common.jsx";

const fmt = (v) => (typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(v < 1 ? 6 : 2)) : String(v));

function Compare({ title, unit, baseline, optimized, lowerIsBetter = true }) {
  const max = Math.max(baseline, optimized, 0.000001);
  const rows = [
    ["Baseline", baseline, "bar-base"],
    ["Optimized", optimized, "bar-opt"],
  ];
  return (
    <div className="compare">
      <h3>{title}</h3>
      {rows.map(([name, value, cls]) => (
        <div className="bar-row" key={name}>
          <span>{name}</span>
          <div className="bar-track">
            <motion.div
              className={`bar ${cls}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max((value / max) * 100, 2)}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
          <strong>{fmt(value)}{unit}</strong>
        </div>
      ))}
      <small className="muted">{lowerIsBetter ? "Lower is better" : "Higher is better"}</small>
    </div>
  );
}

export default function Metrics() {
  const [metrics, setMetrics] = useState(null);
  const [bench, setBench] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [m, b] = await Promise.all([api.costMetrics(), api.benchmarks()]);
      setMetrics(m.metrics);
      setBench(b.benchmark_comparison);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scalars = metrics ? Object.entries(metrics).filter(([, v]) => typeof v !== "object") : [];
  const nested = metrics ? Object.entries(metrics).filter(([, v]) => typeof v === "object" && v) : [];
  const base = bench?.baseline_monolithic_qwen;
  const opt = bench?.optimized_dynamic_routing_with_caching;
  const imp = bench?.improvement;

  return (
    <>
      <PageHeader title="Cost and performance">
        Live token use and cost, compared against a single-model baseline.
      </PageHeader>
      <div className="toolbar">
        <button className="btn btn-secondary" onClick={load}>
          <Icon name="refresh" size={18} /> Refresh
        </button>
      </div>
      <Notice kind="error">{error}</Notice>

      {metrics && (
        <section className="stat-grid">
          {scalars.map(([k, v]) => (
            <div className="card stat" key={k}>
              <span>{label(k)}</span>
              <strong>{fmt(v)}</strong>
            </div>
          ))}
        </section>
      )}

      {nested.map(([k, v]) => (
        <section className="card" key={k}>
          <h2>{label(k)}</h2>
          <DataView data={v} />
        </section>
      ))}

      {base && opt && (
        <section className="card">
          <h2>Baseline vs optimized</h2>
          {imp && (
            <div className="status-row">
              <span className="chip chip-ok">{imp.cost_reduction_pct}% lower cost</span>
              <span className="chip chip-ok">{imp.speedup_factor}</span>
            </div>
          )}
          <Compare title="Average latency" unit=" s" baseline={base.average_latency_sec} optimized={opt.average_latency_sec} />
          <Compare title="Cost per request" unit=" USD" baseline={base.cost_per_request_usd} optimized={opt.cost_per_request_usd} />
          <Compare title="Cache hit rate" unit="%" baseline={base.cache_hit_rate_pct} optimized={opt.cache_hit_rate_pct} lowerIsBetter={false} />
        </section>
      )}
    </>
  );
}

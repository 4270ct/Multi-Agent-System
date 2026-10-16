import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import HistoryPanel from "./HistoryPanel.jsx";
import useHistory from "../useHistory.js";
import { Disclosure, DataView, Notice, asText, label } from "./common.jsx";

const SUGGESTIONS = [
  "Analyze last quarter's sales and recommend three actions",
  "Research our top competitors and draft a pricing plan",
  "Summarize customer feedback and propose fixes",
];

const taskText = (t) =>
  typeof t === "string" ? t : t.description || t.task || t.title || t.name || t.id || asText(t);
const taskAgent = (t) => (typeof t === "object" ? t.agent || t.assignee || t.type || t.role : null);

function TypingDots() {
  return (
    <div className="bubble bubble-agent typing" aria-label="Agents are working">
      <span /> <span /> <span />
    </div>
  );
}

function Plan({ plan, current, done }) {
  if (!plan?.length) return null;
  return (
    <section className="card">
      <h2>Plan</h2>
      <ol className="plan">
        {plan.map((t, i) => {
          const id = typeof t === "object" ? t.id : null;
          const complete = i < current || (id && done.includes(id));
          const active = i === current && !complete;
          return (
            <li key={i} className={complete ? "is-done" : active ? "is-active" : ""}>
              <span className="plan-dot">{complete ? <Icon name="check" size={14} /> : i + 1}</span>
              <div>
                <p>{taskText(t)}</p>
                {taskAgent(t) && <small>{taskAgent(t)}</small>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function Console({ userId, ready = true }) {
  const [prompt, setPrompt] = useState("");
  const [simulate, setSimulate] = useState(false);
  const [asked, setAsked] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const history = useHistory(userId);

  const fs = result?.final_state;
  const needsApproval =
    fs && !fs.approval_granted && (fs.requires_approval || fs.pending_approval_task);
  const blocked = fs?.status === "blocked_security";

  async function run(text = prompt) {
    const request = text.trim();
    if (!request || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    setAsked(request);
    const historyId = history.add(request);
    try {
      const res = await api.run({ request, user_id: userId, simulate_api_failure: simulate });
      setResult(res);
      setPrompt("");
      history.update(historyId, { status: res.final_state?.status || "completed" });
    } catch (e) {
      setError(e.message);
      history.update(historyId, { status: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    setLoading(true);
    setError("");
    try {
      const res = await api.resume({
        request: fs.request || asked,
        user_id: userId,
        completed_task_ids: fs.completed_task_ids || [],
        current_step_index: fs.current_step_index ?? 0,
        plan: fs.plan || [],
        research_data: fs.research_data ?? null,
        analysis_results: fs.analysis_results ?? null,
        messages: fs.messages || [],
      });
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const started = loading || result || error;

  function reset() {
    setResult(null);
    setError("");
    setAsked("");
    setPrompt("");
  }

  const historyPanel = (
    <HistoryPanel
      items={history.items}
      onSelect={run}
      onRemove={history.remove}
      onClear={history.clear}
      disabled={loading}
      ready={ready}
    />
  );

  return (
    <div className="console">
      <AnimatePresence initial={false}>
        {!started && (
          <motion.div
            key="hero"
            className="hero"
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={ready ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              What should the agents work on?
            </motion.h1>
            <motion.span
              className="ornament"
              initial={{ scaleX: 0 }}
              animate={ready ? { scaleX: 1 } : undefined}
              transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
            />
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={ready ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            >
              Describe a business goal. The planner breaks it into steps, then the agents
              research, analyze, execute, and verify each one.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {started && (
        <div className="thread" aria-live="polite">
          {!loading && (
            <button className="btn btn-secondary btn-sm new-search" onClick={reset}>
              New search
            </button>
          )}
          <div className="bubble bubble-user">{asked}</div>

          {fs?.messages?.map((m, i) => (
            <motion.div
              key={`${asked}-${i}`}
              className={`bubble bubble-agent ${blocked ? "bubble-warn" : ""}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12 }}
            >
              <small>{label(m.role)}</small>
              <p>{m.content}</p>
            </motion.div>
          ))}

          {loading && <TypingDots />}
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      {fs && !blocked && (
        <>
          <div className="status-row">
            <span className={`chip ${needsApproval ? "chip-warn" : "chip-ok"}`}>
              {label(fs.status || "done")}
            </span>
            {fs.retry_count > 0 && <span className="chip">Retries: {fs.retry_count}</span>}
          </div>

          <AnimatePresence>
            {needsApproval && (
              <motion.section
                className="card approval"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <Icon name="shield" size={24} />
                <div>
                  <h2>Approval needed</h2>
                  <p>
                    {fs.pending_approval_task
                      ? taskText(fs.pending_approval_task)
                      : "A step needs your approval before it runs."}
                  </p>
                </div>
                <button className="btn btn-primary" onClick={approve} disabled={loading}>
                  Approve and continue
                </button>
              </motion.section>
            )}
          </AnimatePresence>

          <Plan plan={fs.plan} current={fs.current_step_index ?? 0} done={fs.completed_task_ids || []} />

          <section className="card">
            <h2>Results</h2>
            {[
              ["research_data", "Research"],
              ["analysis_results", "Analysis"],
              ["execution_output", "Execution"],
              ["verification_result", "Verification"],
            ].map(([key, title]) =>
              fs[key] ? (
                <Disclosure key={key} title={title} defaultOpen={key === "verification_result"}>
                  {typeof fs[key] === "object" ? <DataView data={fs[key]} /> : <pre className="pre">{fs[key]}</pre>}
                </Disclosure>
              ) : null
            )}
            {!fs.research_data && !fs.analysis_results && !fs.execution_output && !fs.verification_result && (
              <p className="muted">Results will appear here once the agents finish a step.</p>
            )}
          </section>
        </>
      )}

      {started && !loading && historyPanel}

      {!started && historyPanel}

      <motion.div
        className="composer-wrap"
        initial={{ opacity: 0, y: 28 }}
        animate={ready ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, delay: 0.55, ease: "easeOut" }}
      >
        {!started && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip chip-button" onClick={() => run(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <label htmlFor="goal" className="sr-only">Describe a goal</label>
          <textarea
            id="goal"
            rows={2}
            value={prompt}
            placeholder="Describe what you want done…"
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
          />
          <div className="composer-bar">
            <label className="switch">
              <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} />
              <span className="switch-track" />
              Simulate API failure
            </label>
            <button className="btn btn-accent" type="submit" disabled={loading || !prompt.trim()}>
              <Icon name="send" size={18} /> Run agents
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

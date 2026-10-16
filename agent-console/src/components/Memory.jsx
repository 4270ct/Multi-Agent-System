import { useState } from "react";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { DataView, Notice, PageHeader } from "./common.jsx";

export default function Memory({ userId }) {
  const [bundle, setBundle] = useState(null);
  const [relevant, setRelevant] = useState(null);
  const [query, setQuery] = useState("");
  const [instruction, setInstruction] = useState("");
  const [priority, setPriority] = useState(1);
  const [memoryType, setMemoryType] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState({ kind: "info", text: "" });

  const guard = (fn, ok) => async () => {
    setMsg({ kind: "info", text: "" });
    try {
      await fn();
      if (ok) setMsg({ kind: "info", text: ok });
    } catch (e) {
      setMsg({ kind: "error", text: e.message });
    }
  };

  const load = guard(async () => setBundle((await api.getMemory(userId)).memory));
  const search = guard(async () =>
    setRelevant((await api.relevantMemory({ user_id: userId, query })).relevant_memory)
  );
  const add = guard(async () => {
    await api.addInstruction({ user_id: userId, content: instruction, priority: Number(priority) });
    setInstruction("");
    setBundle((await api.getMemory(userId)).memory);
  }, "Instruction saved.");
  const remove = guard(async () => {
    await api.deleteMemory({
      user_id: userId,
      memory_type: memoryType || null,
      key: key || null,
    });
    setBundle((await api.getMemory(userId)).memory);
  }, "Memory deleted.");

  return (
    <>
      <PageHeader title="Memory">
        What the agents remember for <strong>{userId}</strong>. Change the user in the sidebar.
      </PageHeader>
      <Notice kind={msg.kind}>{msg.text}</Notice>

      <div className="two-col">
        <section className="card">
          <h2>Add an instruction</h2>
          <label htmlFor="ins">Instruction</label>
          <textarea id="ins" rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Always report costs in USD" />
          <label htmlFor="pri">Priority</label>
          <input id="pri" className="input" type="number" min="1" value={priority} onChange={(e) => setPriority(e.target.value)} />
          <button className="btn btn-primary" disabled={!instruction.trim()} onClick={add}>Save instruction</button>
        </section>

        <section className="card">
          <h2>Find relevant memory</h2>
          <label htmlFor="q">Search</label>
          <input id="q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What does the user prefer for reports?" />
          <button className="btn btn-secondary" disabled={!query.trim()} onClick={search}>
            <Icon name="search" size={18} /> Search memory
          </button>
          {relevant && <DataView data={relevant} />}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Stored memory</h2>
          <button className="btn btn-secondary" onClick={load}>Load memory</button>
        </div>
        {bundle ? <DataView data={bundle} /> : <p className="muted">Load memory to see what is stored.</p>}
      </section>

      <section className="card">
        <h2>Delete memory</h2>
        <p className="muted">Leave both fields empty to delete everything stored for this user.</p>
        <div className="two-col">
          <div>
            <label htmlFor="mt">Memory type (optional)</label>
            <input id="mt" className="input" value={memoryType} onChange={(e) => setMemoryType(e.target.value)} />
          </div>
          <div>
            <label htmlFor="mk">Key (optional)</label>
            <input id="mk" className="input" value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-danger" onClick={remove}>
          <Icon name="trash" size={18} /> Delete memory
        </button>
      </section>
    </>
  );
}

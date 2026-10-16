import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { Notice, PageHeader } from "./common.jsx";

const size = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const keyOf = (f) => `${f.name}-${f.size}-${f.lastModified}`;

export default function Documents() {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "info", text: "" });

  function addFiles(list) {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    setFiles((prev) => {
      const seen = new Set(prev.map(keyOf));
      return [...prev, ...incoming.filter((f) => !seen.has(keyOf(f)))];
    });
    setMsg({ kind: "info", text: "" });
  }

  function onDrop(e) {
    e.preventDefault();
    setOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function upload() {
    setBusy(true);
    setMsg({ kind: "info", text: "" });
    try {
      const res = await api.upload(files);
      setMsg({ kind: "info", text: `Indexed ${res.chunks_indexed} chunks from ${files.length} file${files.length > 1 ? "s" : ""}. The agents can now search them.` });
      setFiles([]);
    } catch (e) {
      setMsg({ kind: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Documents">
        Drop files here to add them to the knowledge base the research agent searches.
      </PageHeader>
      <Notice kind={msg.kind}>{msg.text}</Notice>

      <section className="card">
        <div
          className={`dropzone ${over ? "is-over" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Drop files here or press Enter to choose files"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <motion.span animate={{ y: over ? -6 : 0, scale: over ? 1.1 : 1 }} className="dropzone-icon">
            <Icon name="upload" size={32} />
          </motion.span>
          <strong>{over ? "Release to add" : "Drag and drop files here"}</strong>
          <span className="muted">or click to browse</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        <ul className="file-list">
          <AnimatePresence initial={false}>
            {files.map((f) => (
              <motion.li
                key={keyOf(f)}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Icon name="file" size={18} />
                <span className="file-name">{f.name}</span>
                <small>{size(f.size)}</small>
                <button className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((x) => x !== f))}>
                  <Icon name="x" size={16} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <button className="btn btn-primary" disabled={busy || !files.length} onClick={upload}>
          <Icon name="upload" size={18} />
          {busy ? "Indexing…" : files.length ? `Index ${files.length} file${files.length > 1 ? "s" : ""}` : "Index files"}
        </button>
      </section>
    </>
  );
}

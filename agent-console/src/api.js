//VITE_API_URL="http://127.0.0.1:8000"


const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error(`Cannot reach the backend at ${BASE}. Start it with "python main.py".`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  run: (body) => post("/api/run-orchestration", body),
  resume: (body) => post("/api/resume-orchestration", body),
  costMetrics: () => request("/api/cost-metrics"),
  benchmarks: () => request("/api/benchmarks"),
  upload: async (files) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    let res;
    try {
      res = await fetch(`${BASE}/api/upload-documents`, { method: "POST", body: form });
    } catch {
      throw new Error(`Cannot reach the backend at ${BASE}. Start it with "python main.py".`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Upload failed (${res.status})`);
    return data;
  },
  getMemory: (userId) => request(`/api/memory/get/${encodeURIComponent(userId)}`),
  relevantMemory: (body) => post("/api/memory/relevant", body),
  addInstruction: (body) => post("/api/memory/instruction", body),
  deleteMemory: (body) => post("/api/memory/delete", body),
};

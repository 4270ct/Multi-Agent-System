import { useCallback, useEffect, useState } from "react";

const MAX = 20;
const keyFor = (userId) => `agent-console:history:${userId}`;

function read(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(userId)) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write(userId, items) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(items));
  } catch {
    /* storage unavailable: history just won't persist */
  }
}

/** Search history kept in the browser, one list per user ID. */
export default function useHistory(userId) {
  const [items, setItems] = useState(() => read(userId));

  useEffect(() => setItems(read(userId)), [userId]);

  const commit = useCallback(
    (updater) =>
      setItems((prev) => {
        const next = updater(prev);
        write(userId, next);
        return next;
      }),
    [userId]
  );

  const add = useCallback(
    (text) => {
      const id = `${Date.now()}`;
      commit((prev) => [
        { id, text, at: Date.now(), status: "running" },
        ...prev.filter((h) => h.text !== text),
      ].slice(0, MAX));
      return id;
    },
    [commit]
  );

  const update = useCallback(
    (id, patch) => commit((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h))),
    [commit]
  );
  const remove = useCallback((id) => commit((prev) => prev.filter((h) => h.id !== id)), [commit]);
  const clear = useCallback(() => commit(() => []), [commit]);

  return { items, add, update, remove, clear };
}

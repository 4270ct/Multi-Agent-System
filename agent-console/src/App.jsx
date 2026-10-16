import { useCallback, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import Icon from "./components/Icon.jsx";
import Splash from "./components/Splash.jsx";
import Console from "./components/Console.jsx";
import Metrics from "./components/Metrics.jsx";
import Memory from "./components/Memory.jsx";
import Documents from "./components/Documents.jsx";

const NAV = [
  { id: "console", name: "Agents", icon: "sparkles" },
  { id: "metrics", name: "Cost", icon: "chart" },
  { id: "memory", name: "Memory", icon: "database" },
  { id: "docs", name: "Documents", icon: "file" },
];

export default function App() {
  const reduce = useReducedMotion();
  const [splash, setSplash] = useState(!reduce);
  const [ready, setReady] = useState(!!reduce);
  const [view, setView] = useState("console");
  const [userId, setUserId] = useState("default_user");

  const reveal = useCallback(() => {
    setReady(true);
    setSplash(false);
  }, []);

  return (
    <>
      <AnimatePresence>{splash && <Splash key="splash" onReveal={reveal} />}</AnimatePresence>

      <div className="shell">
        <motion.aside
          className="nav"
          initial={{ opacity: 0, x: -28 }}
          animate={ready ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="brand">
            <span className="brand-mark"><Icon name="sparkles" size={20} /></span>
            <span>Agent Console</span>
          </div>
          <nav aria-label="Main">
            {NAV.map((n, i) => (
              <motion.button
                key={n.id}
                className={`nav-item ${view === n.id ? "is-active" : ""}`}
                aria-current={view === n.id ? "page" : undefined}
                onClick={() => setView(n.id)}
                initial={{ opacity: 0, x: -12 }}
                animate={ready ? { opacity: 1, x: 0 } : undefined}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
              >
                {view === n.id && (
                  <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
                <Icon name={n.icon} size={20} />
                <span>{n.name}</span>
              </motion.button>
            ))}
          </nav>
          <div className="nav-user">
            <label htmlFor="uid">User ID</label>
            <input id="uid" className="input" value={userId} onChange={(e) => setUserId(e.target.value || "default_user")} />
          </div>
        </motion.aside>

        <main className="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              className="view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {view === "console" && <Console userId={userId} ready={ready} />}
              {view === "metrics" && <Metrics />}
              {view === "memory" && <Memory userId={userId} />}
              {view === "docs" && <Documents />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

import { useEffect } from "react";
import { motion } from "motion/react";

const TITLE = "Agent Console";

export default function Splash({ onReveal }) {
  useEffect(() => {
    const t = setTimeout(onReveal, 2500);
    const skip = () => onReveal();
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, [onReveal]);

  const draw = (delay) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 1.1, delay, ease: "easeInOut" },
  });

  return (
    <motion.div
      className="splash"
      role="presentation"
      onClick={onReveal}
      exit={{ y: "-100%" }}
      transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="splash-inner">
        <svg width="132" height="132" viewBox="0 0 132 132" fill="none" aria-hidden="true">
          <motion.circle cx="66" cy="66" r="62" stroke="currentColor" strokeWidth="2" {...draw(0)} />
          <motion.circle cx="66" cy="66" r="54" stroke="currentColor" strokeWidth="1" {...draw(0.2)} />
          <motion.path
            d="M66 28 L74 58 L104 66 L74 74 L66 104 L58 74 L28 66 L58 58 Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            {...draw(0.5)}
          />
        </svg>

        <h1 className="splash-title" aria-label={TITLE}>
          {TITLE.split("").map((c, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.05, duration: 0.3 }}
            >
              {c === " " ? "\u00A0" : c}
            </motion.span>
          ))}
        </h1>

        <motion.span
          className="ornament"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.5, duration: 0.6, ease: "easeOut" }}
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7, duration: 0.5 }}
        >
          Plan, research, execute, verify.
        </motion.p>
      </div>
    </motion.div>
  );
}

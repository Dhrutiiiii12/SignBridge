import { motion } from "motion/react";

export type StatusChipVariant = "reading" | "interpreting" | "waiting" | "ready";

interface StatusChipProps {
  variant: StatusChipVariant;
}

export function StatusChip({ variant }: StatusChipProps) {
  const cfg = {
    reading:      { dot: "#E8845A", text: "Reading",      textColor: "#E8845A",  bg: "rgba(255,255,255,0.92)", pulse: true },
    interpreting: { dot: "#D4608A", text: "Interpreting", textColor: "#D4608A",  bg: "rgba(255,255,255,0.92)", pulse: true },
    waiting:      { dot: "#C4B8B0", text: "Waiting",      textColor: "#8B7E78",  bg: "rgba(255,255,255,0.92)", pulse: false },
    ready:        { dot: "#E8845A", text: "Listening",    textColor: "#A89B95",  bg: "rgba(255,255,255,0.92)", pulse: false },
  }[variant];

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: cfg.bg,
      borderRadius: 99, padding: "0 12px", height: 28,
      backdropFilter: "blur(10px)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      border: "1px solid rgba(0,0,0,0.05)",
    }}>
      <motion.div
        style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }}
        animate={cfg.pulse ? { opacity: [1, 0.3, 1], scale: [1, 0.8, 1] } : { opacity: 1 }}
        transition={cfg.pulse ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
      />
      <span style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 12, fontWeight: 500,
        color: cfg.textColor,
        letterSpacing: "0.02em",
      }}>
        {cfg.text}
      </span>
    </div>
  );
}

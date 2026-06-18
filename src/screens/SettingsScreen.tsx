import { useState } from "react";
import { ArrowLeft } from "lucide-react";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 48, height: 28,
        background: on ? "linear-gradient(90deg, #F9C5B0, #E8845A)" : "rgba(0,0,0,0.08)",
        borderRadius: 99, border: "none", cursor: "pointer",
        position: "relative", transition: "background 0.25s", flexShrink: 0,
        boxShadow: on ? "0 2px 8px rgba(232,132,90,0.3)" : "none",
      }}
    >
      <div style={{
        position: "absolute", top: 3,
        left: on ? 23 : 3, width: 22, height: 22,
        borderRadius: "50%", background: "#FFFFFF",
        transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }} />
    </button>
  );
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState({
    keepScreenOn: true, highContrast: false,
    autoScroll: false, showConfidence: false,
    flashlight: false, vibrate: false,
    textSize: "Standard" as "Standard" | "Large" | "Extra Large",
    language: "ASL",
  });
  const set = (k: keyof typeof s, v: unknown) => setS(p => ({ ...p, [k]: v }));

  const Section = ({ title }: { title: string }) => (
    <div>
      <p style={{ color: "#C4B8B0", fontSize: 11, fontFamily: "Inter, sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", margin: "24px 0 0", padding: "0 20px" }}>
        {title}
      </p>
      <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "8px 20px 0" }} />
    </div>
  );

  const Row = ({ label, right }: { label: string; right: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", minHeight: 48 }}>
      <span style={{ color: "#1A1A1A", fontSize: 15, fontFamily: "Inter, sans-serif" }}>{label}</span>
      {right}
    </div>
  );

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100%", fontFamily: "Inter, sans-serif" }}>
      <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#1A1A1A", fontSize: 15, fontWeight: 500 }}>
          <ArrowLeft size={18} color="#A89B95" />
          <span style={{ fontFamily: "Playfair Display, Georgia, serif", fontWeight: 600 }}>Settings</span>
        </button>
      </div>

      <Section title="Display" />
      <Row label="Text size" right={
        <div style={{ display: "flex", gap: 6 }}>
          {(["Standard", "Large", "Extra Large"] as const).map(size => (
            <button key={size} onClick={() => set("textSize", size)} style={{
              height: 32, padding: "0 10px",
              background: s.textSize === size ? "linear-gradient(135deg, #FBD5C4, #F5A07A)" : "#FAF8F5",
              border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8,
              color: s.textSize === size ? "#FFFFFF" : "#8B7E78",
              fontSize: size === "Standard" ? 12 : 13, fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              boxShadow: s.textSize === size ? "0 2px 8px rgba(232,132,90,0.25)" : "none",
            }}>
              {size === "Standard" ? "A" : size === "Large" ? "A+" : "A++"}
            </button>
          ))}
        </div>
      } />
      <Row label="Keep screen on" right={<Toggle on={s.keepScreenOn} onChange={v => set("keepScreenOn", v)} />} />
      <Row label="High contrast" right={<Toggle on={s.highContrast} onChange={v => set("highContrast", v)} />} />

      <Section title="Translation" />
      <Row label="Sign language" right={
        <select value={s.language} onChange={e => set("language", e.target.value)} style={{
          background: "#FAF8F5", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10,
          color: "#1A1A1A", fontSize: 14, fontFamily: "Inter, sans-serif",
          padding: "6px 10px", cursor: "pointer", outline: "none",
        }}>
          {["ASL", "BSL", "ISL", "Auslan", "Others"].map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      } />
      <Row label="Auto-scroll text" right={<Toggle on={s.autoScroll} onChange={v => set("autoScroll", v)} />} />
      <Row label="Show confidence" right={<Toggle on={s.showConfidence} onChange={v => set("showConfidence", v)} />} />

      <Section title="Tools" />
      <Row label="Flashlight" right={<Toggle on={s.flashlight} onChange={v => set("flashlight", v)} />} />
      <Row label="Vibrate on detect" right={<Toggle on={s.vibrate} onChange={v => set("vibrate", v)} />} />

      <Section title="About" />
      <div style={{ padding: "14px 20px" }}>
        <p style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 17, fontWeight: 500, color: "#1A1A1A", margin: "0 0 4px" }}>SignBridge</p>
        <p style={{ color: "#A89B95", fontSize: 13, margin: 0 }}>Designed for accessibility · v1.0</p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

const QUICK_REPLIES = ["One moment", "Please wait", "I'll get help", "Can you write it?", "I understand", "Can you repeat that?"];

interface Props {
  onBack: () => void;
  onSend: (text: string) => void;
}

export function ReplyModeScreen({ onBack, onSend }: Props) {
  const [inputText, setInputText] = useState("");
  const [displayText, setDisplayText] = useState("");

  const handleShow = () => {
    if (!inputText.trim()) return;
    setDisplayText(inputText.trim());
    onSend(inputText.trim());
  };

  const handleQuick = (text: string) => {
    setInputText(text); setDisplayText(text); onSend(text);
  };

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100%", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <div style={{ padding: "16px 20px 0" }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          color: "#A89B95", fontSize: 14, padding: "8px 0",
        }}>
          <ArrowLeft size={16} color="#C4B8B0" /> Back to signing
        </button>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        <div style={{
          background: "#FAF8F5", borderRadius: 24, padding: "24px 20px", minHeight: 140,
          display: "flex", alignItems: "center",
          border: "1px solid rgba(0,0,0,0.05)",
          boxShadow: "0 4px 24px rgba(200,140,120,0.08)",
        }}>
          {displayText ? (
            <p style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontSize: 30, fontWeight: 500,
              color: "#1A1A1A", lineHeight: 1.3, margin: 0,
            }}>
              {displayText}
            </p>
          ) : (
            <p style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontSize: 22, fontWeight: 500,
              color: "#C4B8B0", margin: 0, fontStyle: "italic",
            }}>
              Your reply appears here for them to read
            </p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 20px 0" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
        <span style={{ color: "#C4B8B0", fontSize: 13 }}>Your reply</span>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
      </div>

      <div style={{ padding: "12px 20px 0" }}>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type your reply..."
          rows={3}
          style={{
            width: "100%", background: "#FAF8F5",
            border: "1px solid rgba(0,0,0,0.07)", borderRadius: 18,
            padding: "14px", color: "#1A1A1A", fontSize: 15,
            fontFamily: "Inter, sans-serif", outline: "none",
            resize: "none", boxSizing: "border-box", lineHeight: 1.5,
          }}
        />
      </div>

      <div style={{ padding: "12px 20px 0" }}>
        <button onClick={handleShow} style={{
          width: "100%", height: 56,
          background: "linear-gradient(135deg, #F9C5B0 0%, #E8845A 55%, #D4608A 100%)",
          border: "none", borderRadius: 99,
          color: "#FFFFFF", fontSize: 17, fontWeight: 600,
          fontFamily: "Inter, sans-serif", cursor: "pointer",
          boxShadow: "0 8px 24px rgba(232,132,90,0.3)",
        }}>
          Show them →
        </button>
      </div>

      <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "20px 20px 0" }} />
      <div style={{ padding: "14px 20px 0" }}>
        <p style={{ color: "#A89B95", fontSize: 13, margin: "0 0 10px" }}>Quick replies</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {QUICK_REPLIES.map(phrase => (
            <button key={phrase} onClick={() => handleQuick(phrase)} style={{
              height: 36, padding: "0 14px",
              background: inputText === phrase ? "linear-gradient(135deg, #FBD5C4, #F5A07A)" : "#FAF8F5",
              border: "1px solid rgba(0,0,0,0.07)", borderRadius: 99,
              color: inputText === phrase ? "#FFFFFF" : "#8B7E78",
              fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: 500,
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: inputText === phrase ? "0 4px 12px rgba(232,132,90,0.25)" : "none",
            }}>
              {phrase}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Settings, Send } from "lucide-react";
import { toast } from "sonner";

export interface Message {
  id: string;
  text: string;
  type: "signed" | "typed";
  time: string;
}

interface Props {
  messages: Message[];
  onBack: () => void;
  onSettings: () => void;
  onReply: () => void;
  onAddTyped: (text: string) => void;
}

export function ConversationScreen({ messages, onBack, onSettings, onAddTyped }: Props) {
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!replyText.trim()) return;
    onAddTyped(replyText.trim());
    setReplyText("");
  };

  const handleTap = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied", { duration: 2000 });
  };

  return (
    <div style={{ background: "#FAF8F5", height: "100%", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <div style={{
        height: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", borderBottom: "1px solid rgba(0,0,0,0.05)",
        background: "#FFFFFF", flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#1A1A1A", fontSize: 15, fontWeight: 500 }}>
          <ArrowLeft size={18} color="#A89B95" />
          Conversation
        </button>
        <button onClick={onSettings} style={{ width: 36, height: 36, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Settings size={17} color="#A89B95" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 40 }}>
            <p style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22, fontWeight: 500, color: "#C4B8B0", margin: "0 0 8px", fontStyle: "italic" }}>
              No conversation yet
            </p>
            <p style={{ color: "#C4B8B0", fontSize: 14, margin: 0 }}>Start signing to begin</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isSigned = msg.type === "signed";
          const showTime = idx === 0 || new Date(msg.time).getTime() - new Date(messages[idx - 1].time).getTime() > 5 * 60 * 1000;

          return (
            <div key={msg.id}>
              {showTime && (
                <p style={{ textAlign: "center", color: "#C4B8B0", fontSize: 11, margin: idx === 0 ? "0 0 8px" : "8px 0" }}>
                  {new Date(msg.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              <div style={{ display: "flex", justifyContent: isSigned ? "flex-start" : "flex-end" }}>
                <div
                  onClick={() => handleTap(msg.text)}
                  style={{
                    maxWidth: "80%",
                    background: isSigned ? "#FFFFFF" : "linear-gradient(135deg, #FBD5C4 0%, #F5A07A 100%)",
                    borderRadius: 18, padding: "12px 16px", cursor: "pointer",
                    boxShadow: isSigned ? "0 2px 12px rgba(0,0,0,0.06)" : "0 4px 16px rgba(232,132,90,0.25)",
                  }}
                >
                  <p style={{
                    color: isSigned ? "#1A1A1A" : "#FFFFFF",
                    fontFamily: "Playfair Display, Georgia, serif",
                    fontSize: 16, fontWeight: 500, lineHeight: 1.45, margin: "0 0 6px",
                  }}>
                    {msg.text}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {isSigned ? (
                      <>
                        <span style={{ fontSize: 10 }}>🤟</span>
                        <span style={{ color: "#E8845A", fontSize: 11 }}>via sign language</span>
                      </>
                    ) : (
                      <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>✦ typed</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", padding: "12px 16px 16px", background: "#FFFFFF", flexShrink: 0 }}>
        <button onClick={onBack} style={{
          width: "100%", height: 40, background: "transparent",
          border: "1px solid rgba(232,132,90,0.3)", borderRadius: 99,
          color: "#E8845A", fontSize: 14, fontFamily: "Inter, sans-serif",
          cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          ← Back to live signing
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Type a reply..."
            style={{
              flex: 1, height: 44, background: "#FAF8F5",
              border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14,
              padding: "0 14px", color: "#1A1A1A", fontSize: 15,
              fontFamily: "Inter, sans-serif", outline: "none",
            }}
          />
          <button onClick={handleSend} style={{
            width: 44, height: 44,
            background: "linear-gradient(135deg, #F9C5B0 0%, #E8845A 55%, #D4608A 100%)",
            border: "none", borderRadius: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(232,132,90,0.3)",
          }}>
            <Send size={17} color="#FFFFFF" />
          </button>
        </div>
      </div>
    </div>
  );
}

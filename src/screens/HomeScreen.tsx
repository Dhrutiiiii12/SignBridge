import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

interface HomeScreenProps {
  cameraPermitted: boolean;
  onStart: () => void;
  onTypeInstead: () => void;
}

export function HomeScreen({ cameraPermitted, onStart, onTypeInstead }: HomeScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!cameraPermitted) return;
    let cancelled = false;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); setCameraReady(true); };
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [cameraPermitted]);

  return (
    <div style={{
      background: "#FFFFFF",
      minHeight: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "0 20px 40px",
      fontFamily: "Inter, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: "-60px", right: "-80px",
        width: 320, height: 320,
        background: "radial-gradient(ellipse at 60% 40%, rgba(249,197,176,0.55) 0%, rgba(232,132,90,0.3) 45%, transparent 75%)",
        filter: "blur(40px)", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", bottom: "15%", left: "-60px",
        width: 220, height: 220,
        background: "radial-gradient(ellipse, rgba(212,96,138,0.15) 0%, transparent 70%)",
        filter: "blur(32px)", pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", paddingTop: 20, marginBottom: 8, display: "flex", justifyContent: "center" }}>
        <span style={{ color: "#C4B8B0", fontSize: 13, letterSpacing: "0.04em" }}>SignBridge</span>
      </div>

      <div style={{
        position: "relative", zIndex: 1, width: "100%",
        aspectRatio: "4/5", borderRadius: 24, overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.06)", background: "#FAF8F5", marginTop: 4,
      }}>
        {cameraReady && (
          <video ref={videoRef} autoPlay playsInline muted style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", transform: "scaleX(-1)",
            filter: "blur(6px) brightness(0.88)",
          }} />
        )}
        {!cameraReady && (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(160deg, #FAF0EC 0%, #F5E8E2 100%)",
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 10,
        }}>
          <div style={{
            width: 56, height: 56, background: "rgba(255,255,255,0.85)",
            borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", boxShadow: "0 4px 20px rgba(200,140,120,0.12)",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E8845A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", marginTop: 28 }}>
        <h1 style={{
          fontFamily: "Playfair Display, Georgia, serif",
          fontSize: 40, fontWeight: 600, lineHeight: 1.2,
          color: "#1A1A1A", margin: "0 0 10px", letterSpacing: "-0.01em",
        }}>
          Talk freely.
        </h1>
        <p style={{ color: "#8B7E78", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
          Sign into the camera.<br />The words appear here.
        </p>
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", marginTop: 32 }}>
        <motion.button
          onClick={onStart}
          whileTap={{ scale: 0.97 }}
          style={{
            width: "100%", height: 58,
            background: "linear-gradient(135deg, #F9C5B0 0%, #E8845A 55%, #D4608A 100%)",
            border: "none", borderRadius: 99,
            color: "#FFFFFF", fontSize: 17, fontWeight: 600,
            fontFamily: "Inter, sans-serif", cursor: "pointer",
            boxShadow: "0 8px 28px rgba(232,132,90,0.35)",
            letterSpacing: "0.01em",
          }}
        >
          Start Now
        </motion.button>
      </div>

      <div style={{ position: "relative", zIndex: 1, marginTop: 20 }}>
        <button
          onClick={onTypeInstead}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "#A89B95", fontSize: 15, fontFamily: "Inter, sans-serif",
            display: "flex", alignItems: "center", gap: 4, padding: "8px 0",
          }}
        >
          Type instead →
        </button>
      </div>
    </div>
  );
}

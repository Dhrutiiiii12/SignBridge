import { useState } from "react";
import { motion } from "motion/react";

interface CameraPermissionProps {
  onGranted: () => void;
  onDenied: () => void;
}

export function CameraPermission({ onGranted, onDenied }: CameraPermissionProps) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = async () => {
    setRequesting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(t => t.stop());
      onGranted();
    } catch (err: unknown) {
      setRequesting(false);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Camera access was denied.\nTap the camera icon in your browser's address bar to allow it, then try again.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      }
    }
  };

  return (
    <div style={{
      background: "#FFFFFF",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 28px 48px",
      fontFamily: "Inter, sans-serif",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        top: "-40px", left: "50%",
        transform: "translateX(-50%)",
        width: 340, height: 340,
        background: "radial-gradient(ellipse at 50% 40%, rgba(249,197,176,0.5) 0%, rgba(232,132,90,0.25) 45%, transparent 72%)",
        filter: "blur(48px)",
        pointerEvents: "none",
      }} />

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ position: "relative", zIndex: 1, marginBottom: 40 }}
      >
        <div style={{
          width: 120, height: 120,
          background: "linear-gradient(135deg, #FAF0EC 0%, #F5E3DC 100%)",
          borderRadius: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 32px rgba(232,132,90,0.18)",
          position: "relative",
        }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <defs>
              <linearGradient id="handGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F9C5B0"/>
                <stop offset="55%" stopColor="#E8845A"/>
                <stop offset="100%" stopColor="#D4608A"/>
              </linearGradient>
            </defs>
            <path d="M28 44 C28 44 14 38 14 26 L14 18 C14 16.3 15.3 15 17 15 C18.7 15 20 16.3 20 18 L20 28" stroke="url(#handGrad)" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <path d="M20 22 C20 20.3 21.3 19 23 19 C24.7 19 26 20.3 26 22 L26 28" stroke="url(#handGrad)" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <path d="M26 21 C26 19.3 27.3 18 29 18 C30.7 18 32 19.3 32 21 L32 28" stroke="url(#handGrad)" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <path d="M32 23 C32 21.3 33.3 20 35 20 C36.7 20 38 21.3 38 23 L38 32 C38 38 33 44 28 44 Z" stroke="url(#handGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>

          <motion.div
            animate={{ y: [0, -6, 0], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute", top: -10, right: -10,
              width: 28, height: 28,
              background: "linear-gradient(135deg, #F9C5B0, #E8845A)",
              borderRadius: "50%",
              boxShadow: "0 4px 12px rgba(232,132,90,0.4)",
            }}
          />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        style={{
          fontFamily: "Playfair Display, Georgia, serif",
          fontSize: 30, fontWeight: 600, lineHeight: 1.2,
          color: "#1A1A1A", margin: "0 0 12px",
          position: "relative", zIndex: 1,
        }}
      >
        Camera access<br />needed
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        style={{
          color: "#8B7E78", fontSize: 15, lineHeight: 1.65,
          margin: "0 0 36px", maxWidth: 260,
          position: "relative", zIndex: 1,
        }}
      >
        SignBridge reads your signs through the camera. Your video never leaves this device.
      </motion.p>

      {error && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            background: "#FFF5F5", border: "1px solid rgba(212,96,138,0.2)",
            borderRadius: 14, padding: "14px 16px", marginBottom: 20,
            width: "100%", textAlign: "left", position: "relative", zIndex: 1,
          }}
        >
          <p style={{ color: "#D4608A", fontSize: 14, margin: 0, lineHeight: 1.5, whiteSpace: "pre-line" }}>
            {error}
          </p>
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4 }}
        onClick={requestPermission}
        disabled={requesting}
        whileTap={{ scale: 0.97 }}
        style={{
          width: "100%", height: 58,
          background: "linear-gradient(135deg, #F9C5B0 0%, #E8845A 55%, #D4608A 100%)",
          border: "none", borderRadius: 99,
          color: "#FFFFFF", fontSize: 17, fontWeight: 600, fontFamily: "Inter, sans-serif",
          cursor: requesting ? "default" : "pointer", marginBottom: 14,
          boxShadow: "0 8px 28px rgba(232,132,90,0.32)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          opacity: requesting ? 0.8 : 1, position: "relative", zIndex: 1,
        }}
      >
        {requesting ? (
          <>
            <div style={{
              width: 18, height: 18,
              border: "2px solid rgba(255,255,255,0.4)",
              borderTop: "2px solid #fff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Waiting…
          </>
        ) : "Allow Camera Access"}
      </motion.button>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38, duration: 0.4 }}
        onClick={onDenied}
        style={{
          background: "transparent", border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 99, height: 52, width: "100%",
          cursor: "pointer", color: "#A89B95",
          fontSize: 15, fontFamily: "Inter, sans-serif",
          position: "relative", zIndex: 1,
        }}
      >
        Use text mode instead
      </motion.button>
    </div>
  );
}

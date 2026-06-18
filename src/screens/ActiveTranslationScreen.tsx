import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Settings, Mic, Copy, Send } from "lucide-react";
import { WaveformBar } from "../components/WaveformBar";

// ── Types ──────────────────────────────────────────────────────────────────
type SigningState = "idle" | "detecting" | "processing" | "waiting";

// ── MediaPipe helpers ───────────────────────────────────────────────────────
const MEDIAPIPE_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js",
];
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed: ${src}`));
    document.head.appendChild(s);
  });
}

const DOT_COLORS: Record<SigningState, string> = {
  idle: "#c4b8b0",
  detecting: "#fe9151",
  processing: "#D4608A",
  waiting: "#c4b8b0",
};
const CHIP_LABELS: Record<SigningState, string> = {
  idle: "Ready to read",
  detecting: "Reading signs",
  processing: "Interpreting...",
  waiting: "Waiting...",
};

interface Props {
  cameraPermitted: boolean;
  onReply: () => void;
  onSettings: () => void;
  onConversation: () => void;
  addMessage: (text: string) => void;
}

export function ActiveTranslationScreen({ cameraPermitted, onReply, onSettings, addMessage }: Props) {

  // ── Camera ─────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // ── MediaPipe ──────────────────────────────────────────────────────────
  const handsRef = useRef<{ send: (o: { image: HTMLVideoElement }) => Promise<void> } | null>(null);
  const animFrameRef = useRef<number>(0);
  const mpLoopRunningRef = useRef(false);

  // ── Detection ──────────────────────────────────────────────────────────
  const [handsPresent, setHandsPresent] = useState(false);
  const handsPresentRef = useRef(false);
  const [signingState, setSigningState] = useState<SigningState>("idle");

  // ── Output ─────────────────────────────────────────────────────────────
  const [outputText, setOutputText] = useState("");
  const outputTextRef = useRef("");
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [signsRead, setSignsRead] = useState(0);
  const [currentTime, setCurrentTime] = useState("");

  // ── Hints ──────────────────────────────────────────────────────────────
  const consecutiveWaitingRef = useRef(0);
  const [showLightingTip, setShowLightingTip] = useState(false);
  const lightingTipShownRef = useRef(false);

  // ── API key ────────────────────────────────────────────────────────────
  const envKey = import.meta.env.VITE_MISTRAL_API_KEY as string | undefined;
  const resolvedEnvKey = envKey && envKey !== "your_mistral_api_key_here" ? envKey : "";
  const [apiKey, setApiKey] = useState(() => resolvedEnvKey || localStorage.getItem("sb_api_key") || "");
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(() => !resolvedEnvKey && !localStorage.getItem("sb_api_key"));
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  // ── Reply input ────────────────────────────────────────────────────────
  const [replyText, setReplyText] = useState("");

  // ── Clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const upd = () => setCurrentTime(
      new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
    upd();
    const t = setInterval(upd, 10000);
    return () => clearInterval(t);
  }, []);

  // ── Camera stream ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraPermitted) return;
    let cancelled = false;
    setCameraReady(false); setCameraError(null);
    cancelAnimationFrame(animFrameRef.current);
    mpLoopRunningRef.current = false; handsRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());

    navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1600 } },
      audio: false,
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (cancelled) return;
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    }).catch((err: Error) => {
      if (cancelled) return;
      setCameraError(err.name === "NotAllowedError" ? "Camera denied." : err.name === "NotFoundError" ? "No camera." : err.message);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      mpLoopRunningRef.current = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [cameraPermitted, facingMode]);

  // ── MediaPipe init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraReady || !videoRef.current) return;
    let cancelled = false;

    async function init() {
      try {
        await Promise.all(MEDIAPIPE_SCRIPTS.map(loadScript));
        if (cancelled) return;
        const win = window as unknown as Record<string, unknown>;
        if (!win["Hands"]) throw new Error("no Hands");
        type H = { setOptions: (o: unknown) => void; onResults: (cb: (r: unknown) => void) => void; send: (o: { image: HTMLVideoElement }) => Promise<void> };
        const hands = new (win["Hands"] as new (o: unknown) => H)({
          locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
        hands.onResults((r: unknown) => {
          const detected = ((r as { multiHandLandmarks?: unknown[] }).multiHandLandmarks?.length ?? 0) > 0;
          handsPresentRef.current = detected;
          setHandsPresent(detected);
        });
        handsRef.current = hands;
        if (cancelled) return;

        let lastSend = 0;
        const loop = async (now: number) => {
          if (cancelled || !mpLoopRunningRef.current) return;
          if (now - lastSend >= 150 && videoRef.current?.readyState >= 2 && !videoRef.current.paused && handsRef.current) {
            lastSend = now;
            try { await handsRef.current.send({ image: videoRef.current }); } catch { /* ignore */ }
          }
          animFrameRef.current = requestAnimationFrame(loop);
        };
        mpLoopRunningRef.current = true;
        animFrameRef.current = requestAnimationFrame(loop);
      } catch (e) {
        console.warn("MediaPipe unavailable, fallback simulation.", e);
        if (!cancelled) simulateFallback();
      }
    }
    init();
    return () => { cancelled = true; };
  }, [cameraReady]);

  const simulateFallback = () => {
    let on = false;
    const tick = () => {
      if (!mpLoopRunningRef.current) return;
      on = !on; handsPresentRef.current = on; setHandsPresent(on);
      setTimeout(tick, on ? 5000 : 4000);
    };
    mpLoopRunningRef.current = true; setTimeout(tick, 3000);
  };

  // ── State machine ───────────────────────────────────────────────────────
  useEffect(() => {
    setSigningState(handsPresent ? "detecting" : outputTextRef.current ? "waiting" : "idle");
  }, [handsPresent]);

  // ── Capture interval ────────────────────────────────────────────────────
  useEffect(() => {
    if (!handsPresent || !cameraReady) return;
    const iv = setInterval(captureAndTranslate, 2500);
    return () => clearInterval(iv);
  }, [handsPresent, cameraReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const captureAndTranslate = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    await sendToMistral(canvas.toDataURL("image/jpeg", 0.75).split(",")[1]);
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mistral Vision ──────────────────────────────────────────────────────
  const sendToMistral = async (base64Image: string) => {
    const key = resolvedEnvKey || localStorage.getItem("sb_api_key") || apiKey;
    if (!key) return;
    setSigningState("processing");
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "pixtral-12b-2409", max_tokens: 80,
          messages: [
            { role: "system", content: "You are a real-time ASL interpreter. If person is signing, output ONLY the English phrase — no preamble, no quotes. If unclear, add tilde: e.g. 'medication~'. If no hands or not signing output exactly: WAITING. Under 10 words." },
            { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }, { type: "text", text: "What is this person signing?" }] },
          ],
        }),
      });
      clearTimeout(tid);
      const data = await res.json();
      const result: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
      if (!result || result === "WAITING") {
        consecutiveWaitingRef.current += 1;
        if (consecutiveWaitingRef.current >= 3 && !lightingTipShownRef.current && handsPresentRef.current) {
          lightingTipShownRef.current = true;
          setShowLightingTip(true);
          setTimeout(() => setShowLightingTip(false), 5000);
        }
      } else {
        consecutiveWaitingRef.current = 0;
        appendToTranslation(result);
      }
    } catch (err) {
      clearTimeout(tid);
      if ((err as Error).name !== "AbortError") console.error("Translation error:", err);
    } finally {
      setSigningState(handsPresentRef.current ? "detecting" : "idle");
    }
  };

  const appendToTranslation = (newText: string) => {
    setOutputText(prev => {
      const updated = prev ? `${prev} ${newText}` : newText;
      outputTextRef.current = updated; return updated;
    });
    setSignsRead(s => s + newText.split(" ").length);
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      const text = outputTextRef.current;
      if (text) { addMessage(text); setOutputText(""); outputTextRef.current = ""; setSigningState("idle"); }
    }, 4000);
  };

  const saveApiKey = () => {
    const trimmed = apiKeyInput.trim(); if (!trimmed) return;
    localStorage.setItem("sb_api_key", trimmed); setApiKey(trimmed);
    setShowApiKeyBanner(false); setShowApiKeyModal(false); setApiKeyInput("");
  };

  const flipCamera = () => {
    cancelAnimationFrame(animFrameRef.current); mpLoopRunningRef.current = false;
    handsRef.current = null; setHandsPresent(false); handsPresentRef.current = false;
    setSigningState("idle"); setCameraReady(false);
    setFacingMode(m => m === "user" ? "environment" : "user");
  };

  const isActive = signingState === "detecting" || signingState === "processing";
  const dotColor = DOT_COLORS[signingState];
  const chipLabel = CHIP_LABELS[signingState];

  return (
    <div style={{
      background: "#FFFFFF",
      height: "100%",
      position: "relative",
      overflow: "hidden",
      fontFamily: "Inter, sans-serif",
    }}>

      {/* Title */}
      <p style={{
        position: "absolute", top: 16, left: 0, right: 0,
        textAlign: "center",
        fontFamily: "Playfair Display, Georgia, serif",
        fontSize: 24, fontWeight: 600, color: "#1A1A1A",
        margin: 0, letterSpacing: "-0.01em",
      }}>
        Signbridge
      </p>

      {/* Settings button */}
      <button
        onClick={onSettings}
        style={{
          position: "absolute", top: 16, right: 16,
          width: 36, height: 36,
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Settings size={20} color="#A89B95" />
      </button>

      {/* Camera frame */}
      <div
        onClick={flipCamera}
        style={{
          position: "absolute", top: 68, left: "50%", transform: "translateX(-50%)",
          width: 356, height: 415, borderRadius: 30,
          border: `1.5px solid ${isActive ? "#E8845A" : "#f9c5b0"}`,
          background: "linear-gradient(rgba(255,255,255,0.95) 0%, rgb(255,251,240) 38%, rgba(253,234,225,0.976) 60%, rgba(252,223,211,0.99) 75%, rgb(255,235,245) 99%)",
          boxShadow: isActive ? "0 0 0 3px rgba(249,197,176,0.3)" : "none",
          transition: "border-color 0.4s, box-shadow 0.4s",
          cursor: "pointer",
        }}
        title="Tap to flip camera"
      >
        {/* Inner camera preview */}
        <div style={{
          position: "absolute", top: 12, left: 3, width: 327, height: 329,
          borderRadius: 20, background: "#FFFFFF",
          boxShadow: "0px 4px 8.6px 0px rgba(0,0,0,0.12)", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(160deg, #FAF0EC 0%, #F0DDD5 100%)",
          }} />

          {cameraPermitted && (
            <video
              ref={videoRef} autoPlay playsInline muted
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover",
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
              }}
            />
          )}

          {cameraPermitted && !cameraReady && !cameraError && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(250,240,236,0.7)",
            }}>
              <div style={{
                width: 28, height: 28,
                border: "2px solid rgba(232,132,90,0.2)", borderTop: "2px solid #E8845A",
                borderRadius: "50%", animation: "spin 0.8s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!cameraPermitted && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="72" height="72" viewBox="0 0 56 56" fill="none" opacity={0.25}>
                <defs>
                  <linearGradient id="hg3" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F9C5B0"/>
                    <stop offset="100%" stopColor="#D4608A"/>
                  </linearGradient>
                </defs>
                <path d="M28 44C28 44 14 38 14 26L14 18C14 16.3 15.3 15 17 15C18.7 15 20 16.3 20 18L20 28" stroke="url(#hg3)" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <path d="M20 22C20 20.3 21.3 19 23 19C24.7 19 26 20.3 26 22L26 28" stroke="url(#hg3)" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <path d="M26 21C26 19.3 27.3 18 29 18C30.7 18 32 19.3 32 21L32 28" stroke="url(#hg3)" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <path d="M32 23C32 21.3 33.3 20 35 20C36.7 20 38 21.3 38 23L38 32C38 38 33 44 28 44Z" stroke="url(#hg3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
          )}
        </div>

        {/* Bottom hint pill */}
        <div style={{
          position: "absolute", top: 354, left: 13, width: 327, height: 45,
          background: "#FFFFFF", borderRadius: 20,
          display: "flex", alignItems: "center", paddingLeft: 16,
        }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#A89B95", margin: 0, letterSpacing: "0.24px" }}>
            {cameraError ?? (isActive ? "Signing detected — keep hands visible" : "Keep your face in center")}
          </p>
        </div>

        {/* Status chip */}
        <div style={{
          position: "absolute", top: 23, left: 23, height: 28,
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "linear-gradient(96.59deg, rgba(255,255,255,0.92) 1.39%, rgba(245,160,122,0.075) 128.26%)",
          borderRadius: 99, padding: "0 13px",
          boxShadow: "0px 2px 12px 0px rgba(0,0,0,0.08)",
          border: "1px solid rgba(0,0,0,0.05)",
        }}>
          <motion.div
            style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }}
            animate={isActive ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={isActive ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : {}}
          />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#A89B95", letterSpacing: "0.24px", whiteSpace: "nowrap" }}>
            {chipLabel}
          </span>
        </div>
      </div>

      {/* Translated output text */}
      <div style={{ position: "absolute", top: 503, left: 17, right: 17 }}>
        <AnimatePresence mode="wait">
          {outputText ? (
            <motion.p
              key={outputText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontSize: outputText.length < 20 ? 34 : outputText.length < 50 ? 28 : 22,
                fontWeight: 500, lineHeight: 1.35,
                color: "#1A1A1A", margin: 0,
              }}
            >
              {outputText}
            </motion.p>
          ) : (
            <motion.p
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontSize: 28, fontWeight: 500,
                lineHeight: 1.35, color: "#C4B8B0",
                margin: 0, fontStyle: "normal",
              }}
            >
              Translated Text Comes here
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showLightingTip && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ color: "#A89B95", fontSize: 12, margin: "6px 0 0", fontStyle: "italic" }}>
              Tip: better lighting helps accuracy
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Waveform bar */}
      <div style={{ position: "absolute", top: 699, left: 17, width: 350, height: 24 }}>
        <WaveformBar active={isActive} fast={signingState === "processing"} />
      </div>

      {/* Timestamp */}
      <p style={{
        position: "absolute", top: 718, left: 17,
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 12, color: "#C4B8B0",
        margin: 0, lineHeight: "18px",
      }}>
        {currentTime} · {signsRead} signs read
      </p>

      {/* Bottom input bar */}
      <div style={{
        position: "absolute", top: 763, left: 17,
        display: "flex", alignItems: "center", gap: 8,
        paddingTop: 13, paddingBottom: 16,
        borderTop: "1px solid rgba(0,0,0,0.05)",
        width: "calc(100% - 34px)",
      }}>
        <div style={{
          flex: 1, height: 44, background: "#FAF8F5",
          border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14,
          display: "flex", alignItems: "center", padding: "0 11px", gap: 8,
        }}>
          <input
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && replyText.trim()) onReply(); }}
            placeholder="Type your reply..."
            style={{
              flex: 1, background: "transparent", border: "none",
              outline: "none", color: "#1A1A1A", fontSize: 15,
              fontFamily: "Inter, sans-serif",
            }}
          />
          <Mic size={22} fill="#F5A07A" stroke="#F5A07A" style={{ flexShrink: 0 }} />
        </div>

        {/* Copy button */}
        <button
          onClick={() => { if (outputTextRef.current) navigator.clipboard.writeText(outputTextRef.current); }}
          style={{
            width: 44, height: 44, flexShrink: 0,
            background: "#FAF8F5", border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Copy size={16} color="#A89B95" />
        </button>

        {/* Send button */}
        <button
          onClick={onReply}
          style={{
            width: 44, height: 44, flexShrink: 0,
            background: "linear-gradient(135deg, rgb(251,213,196) 0%, rgb(254,147,106) 68%, rgb(255,155,190) 100%)",
            border: "1px solid #dfdddb", borderRadius: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0px 4px 7px rgba(232,132,90,0.3)",
          }}
        >
          <Send size={16} color="white" />
        </button>
      </div>

      {/* API key banner */}
      <AnimatePresence>
        {showApiKeyBanner && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            onClick={() => setShowApiKeyModal(true)}
            style={{
              position: "absolute", bottom: 90, left: 16, right: 16, zIndex: 20,
              background: "#FFFBF0", border: "1px solid rgba(212,96,138,0.2)",
              borderRadius: 14, padding: "12px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", boxShadow: "0 4px 20px rgba(200,140,120,0.12)",
            }}
          >
            <span style={{ color: "#C4860A", fontSize: 13 }}>Mistral API key needed — tap to set up</span>
            <button onClick={e => { e.stopPropagation(); setShowApiKeyBanner(false); }}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
              <X size={14} color="#C4860A" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API key modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "absolute", inset: 0, zIndex: 100,
              background: "rgba(255,251,248,0.95)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 24px", backdropFilter: "blur(8px)",
            }}
          >
            <div style={{
              background: "#FFFFFF", borderRadius: 24, padding: "28px 20px", width: "100%",
              boxShadow: "0 8px 40px rgba(200,140,120,0.16)", border: "1px solid rgba(0,0,0,0.05)",
            }}>
              <h3 style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontSize: 22, fontWeight: 600, color: "#1A1A1A", margin: "0 0 8px",
              }}>Mistral API Key</h3>
              <p style={{ color: "#8B7E78", fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
                SignBridge uses Mistral Pixtral to interpret signs. Stored locally, never shared.
              </p>
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveApiKey()}
                placeholder="Paste your Mistral key..."
                autoFocus
                style={{
                  width: "100%", height: 48,
                  background: "#FAF8F5", border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14, padding: "0 14px", color: "#1A1A1A",
                  fontSize: 14, fontFamily: "JetBrains Mono, monospace",
                  outline: "none", boxSizing: "border-box", marginBottom: 14,
                }}
              />
              <button onClick={saveApiKey} style={{
                width: "100%", height: 52,
                background: "linear-gradient(135deg, #F9C5B0 0%, #E8845A 55%, #D4608A 100%)",
                border: "none", borderRadius: 99,
                color: "#fff", fontSize: 16, fontWeight: 600, fontFamily: "Inter, sans-serif",
                cursor: "pointer", marginBottom: 10,
                boxShadow: "0 4px 20px rgba(232,132,90,0.3)",
              }}>Save Key</button>
              <button onClick={() => setShowApiKeyModal(false)} style={{
                width: "100%", height: 44, background: "transparent", border: "none",
                color: "#A89B95", fontSize: 14, fontFamily: "Inter, sans-serif", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

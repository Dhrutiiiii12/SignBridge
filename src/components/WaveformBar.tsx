import { useEffect, useRef } from "react";

interface WaveformBarProps {
  active: boolean;
  fast?: boolean;
}

export function WaveformBar({ active, fast = false }: WaveformBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (timestamp: number) => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      if (!active) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(196,184,176,0.4)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      } else {
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, "#F9C5B0");
        grad.addColorStop(0.5, "#E8845A");
        grad.addColorStop(1, "#D4608A");

        const speed = fast ? 2.2 : 1;
        const t = (timestamp / 1000) * speed;
        const amp = fast ? 8 : 5;

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#E8845A";
        ctx.shadowBlur = 4;

        const pts = 80;
        for (let i = 0; i <= pts; i++) {
          const x = (i / pts) * width;
          const y = height / 2
            + Math.sin(x * 0.05 + t * 3.0) * amp
            + Math.sin(x * 0.09 + t * 2.2) * (amp * 0.6)
            + Math.sin(x * 0.03 + t * 4.5) * (amp * 0.4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, fast]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={24}
      style={{ width: "100%", height: 24, display: "block" }}
    />
  );
}

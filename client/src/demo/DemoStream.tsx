import { useEffect, useRef } from "react";
import { demoStreamState, pickSampleFor, drawBoxes, DEMO_SAMPLES } from "./demoApi";

// Draws a fake "conveyor camera" on a canvas: a real steel photo scrolling past.
// When the replay logs a defect, we switch to a sample photo of that class.
export function DemoStream({ onReady }: { onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef<Record<string, HTMLImageElement>>({});
  const lastCount = useRef(0);
  const currentFile = useRef(DEMO_SAMPLES[0]?.file ?? "");

  useEffect(() => {
    DEMO_SAMPLES.forEach((s) => {
      const img = new Image();
      img.src = `/samples/${s.file}`;
      images.current[s.file] = img;
    });
    onReady?.();

    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#05080f";
      ctx.fillRect(0, 0, W, H);

      const st = demoStreamState();
      if (!st.active) {
        ctx.fillStyle = "#64748b";
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("CAMERA STANDBY (demo)", W / 2, H / 2 - 8);
        ctx.font = "12px monospace";
        ctx.fillText("Press START INSPECTION to replay a logged coil run", W / 2, H / 2 + 16);
        ctx.textAlign = "left";
        lastCount.current = 0;
        raf = requestAnimationFrame(draw);
        return;
      }

      if (st.count !== lastCount.current) {
        lastCount.current = st.count;
        currentFile.current = pickSampleFor(st.last?.defect_type, st.count).file;
      }
      const sample = DEMO_SAMPLES.find((s) => s.file === currentFile.current);
      const img = images.current[currentFile.current];
      if (sample && img && img.complete && img.naturalWidth > 0) {
        const scale = H / img.naturalHeight;
        const dw = img.naturalWidth * scale;
        const dx = (W - dw) / 2;
        // vertical scroll to suggest motion (purely visual)
        const scroll = (st.elapsed * 120) % H;
        ctx.drawImage(img, dx, scroll, dw, H);
        ctx.drawImage(img, dx, scroll - H, dw, H);
        if (sample.detections) drawBoxes(ctx, sample.detections, scale, dx, scroll);
      }

      ctx.fillStyle = "rgba(2,6,23,0.75)";
      ctx.fillRect(0, H - 30, W, 30);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`LENGTH: ${st.length.toFixed(2)} m`, 12, H - 10);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${st.speed.toFixed(0)} m/s | DEFECTS: ${st.count}`, 190, H - 10);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("DEMO REPLAY, NO LIVE AI", W - 200, H - 10);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={640} height={360} className="w-full h-full object-contain" />;
}

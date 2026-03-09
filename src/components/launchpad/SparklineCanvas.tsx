import { memo, useRef, useEffect } from "react";

interface SparklineCanvasProps {
  data: number[];
}

/** Deterministic hash from a number array to seed micro-variance */
function seedFromData(data: number[]): number {
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    h = ((h << 5) - h + (data[i] * 1000) | 0) | 0;
  }
  return Math.abs(h);
}

/** Add synthetic micro-variance to flat data so chart shows organic movement */
function normalizeFlatData(data: number[]): number[] {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  // If range < 0.1% of mean, data is effectively flat
  if (mean === 0 || range / Math.abs(mean) < 0.001) {
    const seed = seedFromData(data);
    const amplitude = Math.abs(mean) * 0.008 || 0.001;
    // Deterministic random walk
    let v = mean;
    const result: number[] = [];
    for (let i = 0; i < Math.max(data.length, 12); i++) {
      const pseudo = Math.sin(seed * (i + 1) * 0.1) * 0.5 + 0.5;
      v += (pseudo - 0.48) * amplitude;
      result.push(v);
    }
    return result;
  }
  return data;
}

export const SparklineCanvas = memo(function SparklineCanvas({
  data,
}: SparklineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 1) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Normalize flat data
    const normalized = normalizeFlatData(data.length === 1 ? [data[0], data[0]] : data);
    const points = normalized.length < 2 ? [normalized[0], normalized[0]] : normalized;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const isUp = points[points.length - 1] >= points[0];

    const lineColor = isUp ? "34, 197, 94" : "239, 68, 68";

    // Right-aligned: chart occupies the right 55% of card
    const chartLeft = width * 0.45;
    const chartWidth = width - chartLeft;
    const padY = 8;
    const chartH = height - padY * 2;

    const stepX = chartWidth / (points.length - 1);
    const getX = (i: number) => chartLeft + i * stepX;
    const getY = (v: number) => padY + chartH - ((v - min) / range) * chartH;

    // Build coordinate pairs
    const coords = points.map((v, i) => ({ x: getX(i), y: getY(v) }));

    // Draw smooth curve using quadratic bezier
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);

    if (coords.length === 2) {
      ctx.lineTo(coords[1].x, coords[1].y);
    } else {
      for (let i = 0; i < coords.length - 1; i++) {
        const xMid = (coords[i].x + coords[i + 1].x) / 2;
        const yMid = (coords[i].y + coords[i + 1].y) / 2;
        ctx.quadraticCurveTo(coords[i].x, coords[i].y, xMid, yMid);
      }
      // Final segment to last point
      const last = coords[coords.length - 1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.strokeStyle = `rgba(${lineColor}, 0.7)`;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Gradient fill under curve
    ctx.lineTo(chartLeft + chartWidth, height);
    ctx.lineTo(chartLeft, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${lineColor}, 0.35)`);
    gradient.addColorStop(1, `rgba(${lineColor}, 0.02)`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [data]);

  if (data.length < 1) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
});

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Copy, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_IMG = "/images/banner-base.png";
const STORAGE_KEY = "banner-maker-settings";

interface SizePreset {
  label: string;
  w: number;
  h: number;
  ratio: string;
}

const SIZE_PRESETS: SizePreset[] = [
  { label: "X Header", w: 1500, h: 500, ratio: "3/1" },
  { label: "X Post", w: 1600, h: 900, ratio: "16/9" },
  { label: "Square Post", w: 1080, h: 1080, ratio: "1/1" },
  { label: "X Card", w: 1200, h: 628, ratio: "1.91/1" },
];

interface TextBlock {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
}

interface BannerSettings {
  line1: TextBlock;
  line2: TextBlock;
  sizeIndex: number;
}

const defaults: BannerSettings = {
  line1: { text: "", x: 80, y: 200, fontSize: 72, color: "#ffffff", bold: true },
  line2: { text: "", x: 80, y: 300, fontSize: 36, color: "#ffffffbb", bold: false },
  sizeIndex: 0,
};

function loadSettings(): BannerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

export default function BannerMakerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null);
  const [line1, setLine1] = useState<TextBlock>(() => loadSettings().line1);
  const [line2, setLine2] = useState<TextBlock>(() => loadSettings().line2);
  const [sizeIndex, setSizeIndex] = useState(() => loadSettings().sizeIndex);
  const [dragging, setDragging] = useState<"line1" | "line2" | null>(null);
  const { toast } = useToast();

  const size = SIZE_PRESETS[sizeIndex] ?? SIZE_PRESETS[0];

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBaseImg(img);
    img.src = BASE_IMG;
  }, []);

  const drawBanner = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImg) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d")!;

    // Cover-fit the base image
    const imgRatio = baseImg.width / baseImg.height;
    const canvasRatio = size.w / size.h;
    let sw = baseImg.width, sh = baseImg.height, sx = 0, sy = 0;
    if (imgRatio > canvasRatio) {
      sw = baseImg.height * canvasRatio;
      sx = (baseImg.width - sw) / 2;
    } else {
      sh = baseImg.width / canvasRatio;
      sy = (baseImg.height - sh) / 2;
    }
    ctx.drawImage(baseImg, sx, sy, sw, sh, 0, 0, size.w, size.h);

    // Draw texts
    const drawText = (block: TextBlock) => {
      if (!block.text) return;
      ctx.fillStyle = block.color;
      ctx.font = `${block.bold ? "bold " : ""}${block.fontSize}px 'Inter', sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(block.text, block.x, block.y);
    };
    drawText(line1);
    drawText(line2);
  }, [baseImg, line1, line2, size]);

  useEffect(() => { drawBanner(); }, [drawBanner]);

  const getCanvasCoords = (e: React.MouseEvent) => {
    const preview = previewRef.current;
    if (!preview) return null;
    const rect = preview.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (size.w / rect.width),
      y: (e.clientY - rect.top) * (size.h / rect.height),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const c = getCanvasCoords(e);
    if (!c) return;
    const d1 = Math.hypot(c.x - line1.x, c.y - line1.y);
    const d2 = Math.hypot(c.x - line2.x, c.y - line2.y);
    if (line1.text && (d1 < 150 || !line2.text)) setDragging("line1");
    else if (line2.text) setDragging("line2");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const c = getCanvasCoords(e);
    if (!c) return;
    const setter = dragging === "line1" ? setLine1 : setLine2;
    setter((p) => ({ ...p, x: Math.max(0, c.x), y: Math.max(0, c.y) }));
  };

  const handleMouseUp = () => setDragging(null);

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ line1, line2, sizeIndex }));
    toast({ title: "Settings saved! 💾" });
  };

  const downloadBanner = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `banner-${size.w}x${size.h}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const copyBanner = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej()), "image/png")
      );
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({ title: "Copied to clipboard! 📋" });
    } catch {
      toast({ title: "Copy failed", description: "Try downloading instead", variant: "destructive" });
    }
  };

  const updateLine = (which: "line1" | "line2", field: keyof TextBlock, value: string | number | boolean) => {
    const setter = which === "line1" ? setLine1 : setLine2;
    setter((p) => ({ ...p, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Banner Maker</h1>
        <p className="text-muted-foreground text-sm">
          Pick a size, add text, drag to reposition, then download.
        </p>

        {/* Size Picker */}
        <div className="flex gap-2 flex-wrap">
          {SIZE_PRESETS.map((preset, i) => (
            <Button
              key={preset.label}
              size="sm"
              variant={i === sizeIndex ? "default" : "outline"}
              onClick={() => setSizeIndex(i)}
            >
              {preset.label}
              <span className="ml-1.5 text-xs opacity-60">{preset.w}×{preset.h}</span>
            </Button>
          ))}
        </div>

        {/* Controls */}
        <Card>
          <CardHeader><CardTitle className="text-base">Text Lines</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {(["line1", "line2"] as const).map((key, idx) => {
              const block = key === "line1" ? line1 : line2;
              return (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {idx === 0 ? "Main Text" : "Sub Text (optional)"}
                  </label>
                  <div className="flex gap-3 items-end flex-wrap">
                    <Input
                      className="flex-1 min-w-[200px]"
                      value={block.text}
                      onChange={(e) => updateLine(key, "text", e.target.value)}
                      placeholder={idx === 0 ? "e.g. PUNCHIT" : "e.g. Launch tokens in one click"}
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Size</label>
                      <Input type="number" className="w-20" value={block.fontSize}
                        onChange={(e) => updateLine(key, "fontSize", Number(e.target.value))} min={12} max={160} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Color</label>
                      <input type="color" value={block.color.slice(0, 7)}
                        onChange={(e) => updateLine(key, "color", e.target.value)}
                        className="h-10 w-12 rounded cursor-pointer border border-border" />
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">💡 Click &amp; drag on the preview to reposition text</p>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardContent className="p-4">
            <div ref={previewRef} className="relative select-none"
              style={{ cursor: dragging ? "grabbing" : "grab" }}
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
              <canvas ref={canvasRef} width={size.w} height={size.h}
                className="w-full rounded-lg border border-border"
                style={{ aspectRatio: size.ratio }} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 flex-wrap">
          <Button onClick={downloadBanner}>
            <Download className="w-4 h-4 mr-2" /> Download PNG
          </Button>
          <Button variant="outline" onClick={copyBanner}>
            <Copy className="w-4 h-4 mr-2" /> Copy to Clipboard
          </Button>
          <Button variant="secondary" onClick={saveSettings}>
            <Save className="w-4 h-4 mr-2" /> Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

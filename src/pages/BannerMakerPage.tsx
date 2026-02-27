import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Copy, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BANNER_W = 1500;
const BANNER_H = 500;
const BASE_IMG = "/images/banner-base.png";

const STORAGE_KEY = "banner-maker-settings";

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
}

const defaults: BannerSettings = {
  line1: { text: "", x: 80, y: 200, fontSize: 72, color: "#ffffff", bold: true },
  line2: { text: "", x: 80, y: 300, fontSize: 36, color: "#ffffffbb", bold: false },
};

function loadSettings(): BannerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaults;
}

export default function BannerMakerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null);
  const [line1, setLine1] = useState<TextBlock>(() => loadSettings().line1);
  const [line2, setLine2] = useState<TextBlock>(() => loadSettings().line2);
  const [dragging, setDragging] = useState<"line1" | "line2" | null>(null);
  const { toast } = useToast();

  // Load base image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBaseImg(img);
    img.src = BASE_IMG;
  }, []);

  // Draw banner
  const drawBanner = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImg) return;
    const ctx = canvas.getContext("2d")!;

    // Draw base image stretched to fill
    ctx.drawImage(baseImg, 0, 0, BANNER_W, BANNER_H);

    // Draw line 1
    if (line1.text) {
      ctx.fillStyle = line1.color;
      ctx.font = `${line1.bold ? "bold " : ""}${line1.fontSize}px 'Inter', sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(line1.text, line1.x, line1.y);
    }

    // Draw line 2
    if (line2.text) {
      ctx.fillStyle = line2.color;
      ctx.font = `${line2.bold ? "bold " : ""}${line2.fontSize}px 'Inter', sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(line2.text, line2.x, line2.y);
    }
  }, [baseImg, line1, line2]);

  useEffect(() => {
    drawBanner();
  }, [drawBanner]);

  // Mouse handlers for dragging text on preview
  const getCanvasCoords = (e: React.MouseEvent) => {
    const preview = previewRef.current;
    if (!preview) return null;
    const rect = preview.getBoundingClientRect();
    const scaleX = BANNER_W / rect.width;
    const scaleY = BANNER_H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    // Check which text block is closer
    const d1 = Math.hypot(coords.x - line1.x, coords.y - line1.y);
    const d2 = Math.hypot(coords.x - line2.x, coords.y - line2.y);

    if (line1.text && (d1 < 150 || !line2.text)) {
      setDragging("line1");
    } else if (line2.text) {
      setDragging("line2");
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (dragging === "line1") {
      setLine1((p) => ({ ...p, x: Math.max(0, coords.x), y: Math.max(0, coords.y) }));
    } else {
      setLine2((p) => ({ ...p, x: Math.max(0, coords.x), y: Math.max(0, coords.y) }));
    }
  };

  const handleMouseUp = () => setDragging(null);

  // Save to localStorage
  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ line1, line2 }));
    toast({ title: "Settings saved! 💾" });
  };

  const downloadBanner = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "banner-1500x500.png";
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

  const updateLine = (
    which: "line1" | "line2",
    field: keyof TextBlock,
    value: string | number | boolean
  ) => {
    const setter = which === "line1" ? setLine1 : setLine2;
    setter((p) => ({ ...p, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Banner Maker</h1>
        <p className="text-muted-foreground text-sm">
          Add text to the banner, drag to reposition, then download. Settings are saved for next time.
        </p>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Text Lines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Line 1 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Main Text</label>
              <div className="flex gap-3 items-end flex-wrap">
                <Input
                  className="flex-1 min-w-[200px]"
                  value={line1.text}
                  onChange={(e) => updateLine("line1", "text", e.target.value)}
                  placeholder="e.g. PUNCHIT"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Size</label>
                  <Input
                    type="number"
                    className="w-20"
                    value={line1.fontSize}
                    onChange={(e) => updateLine("line1", "fontSize", Number(e.target.value))}
                    min={12}
                    max={120}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Color</label>
                  <input
                    type="color"
                    value={line1.color.slice(0, 7)}
                    onChange={(e) => updateLine("line1", "color", e.target.value)}
                    className="h-10 w-12 rounded cursor-pointer border border-border"
                  />
                </div>
              </div>
            </div>

            {/* Line 2 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sub Text (optional)</label>
              <div className="flex gap-3 items-end flex-wrap">
                <Input
                  className="flex-1 min-w-[200px]"
                  value={line2.text}
                  onChange={(e) => updateLine("line2", "text", e.target.value)}
                  placeholder="e.g. Launch tokens in one click"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Size</label>
                  <Input
                    type="number"
                    className="w-20"
                    value={line2.fontSize}
                    onChange={(e) => updateLine("line2", "fontSize", Number(e.target.value))}
                    min={12}
                    max={120}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Color</label>
                  <input
                    type="color"
                    value={line2.color.slice(0, 7)}
                    onChange={(e) => updateLine("line2", "color", e.target.value)}
                    className="h-10 w-12 rounded cursor-pointer border border-border"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">💡 Click &amp; drag on the preview to reposition text</p>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardContent className="p-4">
            <div
              ref={previewRef}
              className="relative select-none"
              style={{ cursor: dragging ? "grabbing" : "grab" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <canvas
                ref={canvasRef}
                width={BANNER_W}
                height={BANNER_H}
                className="w-full rounded-lg border border-border"
                style={{ aspectRatio: "3/1" }}
              />
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

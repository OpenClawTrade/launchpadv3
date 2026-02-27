import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BANNER_W = 1500;
const BANNER_H = 500;
const LOGO_PATH = "/images/banner-logo.png";

export default function BannerMakerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [bgColor, setBgColor] = useState("#0f0f13");
  const [textColor, setTextColor] = useState("#ffffff");
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const { toast } = useToast();

  // Load logo once
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = LOGO_PATH;
  }, []);

  const drawBanner = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !logoImg) return;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, BANNER_W, BANNER_H);

    // Left side: text
    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";

    const mainText = line1 || "Your Text Here";
    const subText = line2 || "";

    // Auto-size main text
    let fontSize = 72;
    ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
    while (ctx.measureText(mainText).width > BANNER_W * 0.55 && fontSize > 24) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
    }

    const textX = 80;
    const centerY = BANNER_H / 2;

    if (subText) {
      ctx.fillText(mainText, textX, centerY - fontSize * 0.4);
      ctx.font = `${Math.max(24, fontSize * 0.45)}px 'Inter', sans-serif`;
      ctx.fillStyle = textColor + "bb";
      ctx.fillText(subText, textX, centerY + fontSize * 0.55);
    } else {
      ctx.fillText(mainText, textX, centerY);
    }

    // Right side: logo (circular, centered in right half)
    const logoSize = BANNER_H * 0.8;
    const logoX = BANNER_W * 0.65 + (BANNER_W * 0.35 - logoSize) / 2;
    const logoY = (BANNER_H - logoSize) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const scale = Math.max(logoSize / logoImg.width, logoSize / logoImg.height);
    const sw = logoImg.width * scale;
    const sh = logoImg.height * scale;
    ctx.drawImage(logoImg, logoX + (logoSize - sw) / 2, logoY + (logoSize - sh) / 2, sw, sh);
    ctx.restore();

    // Subtle border around logo
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, 0, Math.PI * 2);
    ctx.strokeStyle = textColor + "33";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [line1, line2, bgColor, textColor, logoImg]);

  // Redraw on any change
  useEffect(() => {
    drawBanner();
  }, [drawBanner]);

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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Banner Maker</h1>
        <p className="text-muted-foreground text-sm">Generate a 1500×500 X/Twitter header banner instantly.</p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customize</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Main Text</label>
                <Input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="e.g. PUNCHIT" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Sub Text (optional)</label>
                <Input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="e.g. Launch tokens in one click" />
              </div>
            </div>
            <div className="flex gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Background</label>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-16 rounded cursor-pointer border border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Text Color</label>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-10 w-16 rounded cursor-pointer border border-border" />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setBgColor("#0f0f13"); setTextColor("#ffffff"); }}>
                <RefreshCw className="w-4 h-4 mr-1" /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardContent className="p-4">
            <canvas
              ref={canvasRef}
              width={BANNER_W}
              height={BANNER_H}
              className="w-full rounded-lg border border-border"
              style={{ aspectRatio: "3/1" }}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={downloadBanner}>
            <Download className="w-4 h-4 mr-2" /> Download PNG
          </Button>
          <Button variant="outline" onClick={copyBanner}>
            <Copy className="w-4 h-4 mr-2" /> Copy to Clipboard
          </Button>
        </div>
      </div>
    </div>
  );
}

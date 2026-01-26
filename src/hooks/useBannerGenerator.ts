import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const BANNER_WIDTH = 1500;
const BANNER_HEIGHT = 500;

interface BannerParams {
  imageUrl: string;
  tokenName: string;
  ticker: string;
}

/**
 * Loads an image to canvas with CORS handling
 */
const loadImageToCanvas = (imageUrl: string): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // CRITICAL: Set crossOrigin BEFORE src for external AI images
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
};

/**
 * Extracts the dominant color from a canvas
 */
const extractDominantColor = (canvas: HTMLCanvasElement): string => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#1a1a1f";
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let r = 0, g = 0, b = 0, count = 0;
  
  // Sample every 10th pixel for performance
  for (let i = 0; i < data.length; i += 40) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  
  r = Math.floor(r / count);
  g = Math.floor(g / count);
  b = Math.floor(b / count);
  
  // Darken the color for better contrast
  r = Math.floor(r * 0.7);
  g = Math.floor(g * 0.7);
  b = Math.floor(b * 0.7);
  
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Generates a 1500x500px X banner with token image on right, text on left
 */
const generateXBanner = async (params: BannerParams): Promise<Blob> => {
  const { imageUrl, tokenName, ticker } = params;

  // 1. Load the generated token image
  const tokenImgCanvas = await loadImageToCanvas(imageUrl);
  
  // 2. Extract dominant color from token image
  const backgroundColor = extractDominantColor(tokenImgCanvas);
  
  // 3. Create the banner canvas
  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = BANNER_WIDTH;
  bannerCanvas.height = BANNER_HEIGHT;
  const ctx = bannerCanvas.getContext("2d")!;

  // 4. Draw solid background (no gradient)
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);

  // 5. Draw Token Image on the Right Side (circular mask)
  const imgSize = BANNER_HEIGHT * 0.8; // 80% of banner height
  const imgX = BANNER_WIDTH - imgSize - 100; // 100px from right edge
  const imgY = (BANNER_HEIGHT - imgSize) / 2;
  
  // Create circular clipping mask
  ctx.save();
  ctx.beginPath();
  ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  
  // Draw the token image scaled to fit
  const scale = Math.max(imgSize / tokenImgCanvas.width, imgSize / tokenImgCanvas.height);
  const scaledWidth = tokenImgCanvas.width * scale;
  const scaledHeight = tokenImgCanvas.height * scale;
  const offsetX = imgX + (imgSize - scaledWidth) / 2;
  const offsetY = imgY + (imgSize - scaledHeight) / 2;
  
  ctx.drawImage(tokenImgCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
  ctx.restore();
  
  // Add glow effect around the image
  ctx.save();
  ctx.shadowColor = "rgba(0, 212, 170, 0.5)";
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2 + 5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 212, 170, 0.8)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // 6. Draw text on the left side
  const textX = 80;
  const centerY = BANNER_HEIGHT / 2;
  
  // Token name - large bold text
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px sans-serif";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(tokenName, textX, centerY - 10);
  ctx.restore();
  
  // Ticker - smaller text with accent color
  ctx.save();
  ctx.fillStyle = "#00d4aa";
  ctx.font = "bold 48px sans-serif";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(`$${ticker}`, textX, centerY + 10);
  ctx.restore();

  // 7. Export as Blob
  return new Promise((resolve, reject) => {
    bannerCanvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Banner generation failed")),
      "image/png"
    );
  });
};

export function useBannerGenerator() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const generateBanner = useCallback(async (params: BannerParams) => {
    if (!params.imageUrl || !params.tokenName) {
      toast({
        title: "Missing token data",
        description: "Generate a token first before creating a banner",
        variant: "destructive",
      });
      return null;
    }

    setIsGenerating(true);
    
    try {
      const blob = await generateXBanner(params);
      const url = URL.createObjectURL(blob);
      setBannerUrl(url);
      
      toast({
        title: "Banner Generated! 🎨",
        description: "Your 1500x500 X header banner is ready",
      });
      
      return { blob, url };
    } catch (error) {
      console.error("[BannerGenerator] Error:", error);
      toast({
        title: "Banner generation failed",
        description: error instanceof Error ? error.message : "Failed to generate banner",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const downloadBanner = useCallback((url: string, tokenName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tokenName.toLowerCase().replace(/\s+/g, "-")}-banner.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const clearBanner = useCallback(() => {
    if (bannerUrl) {
      URL.revokeObjectURL(bannerUrl);
      setBannerUrl(null);
    }
  }, [bannerUrl]);

  return {
    generateBanner,
    downloadBanner,
    clearBanner,
    isGenerating,
    bannerUrl,
  };
}

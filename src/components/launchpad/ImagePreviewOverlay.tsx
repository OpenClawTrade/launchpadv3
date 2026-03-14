import { Download, X } from "lucide-react";

interface ImagePreviewOverlayProps {
  src: string;
  alt?: string;
  onClear?: () => void;
  downloadName?: string;
}

export function ImagePreviewOverlay({ src, alt = "Generated", onClear, downloadName = "token.png" }: ImagePreviewOverlayProps) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = downloadName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative w-full h-full group">
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      {onClear && (
        <button
          onClick={onClear}
          className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-background/95 border border-border hover:bg-destructive/20 transition-colors z-10"
          title="Remove image"
        >
          <X className="h-4 w-4 text-foreground" />
        </button>
      )}
      <button
        onClick={handleDownload}
        className="absolute bottom-1.5 right-1.5 px-2 py-1.5 rounded-md bg-background/95 border border-border hover:bg-primary/15 transition-colors z-10 flex items-center gap-1"
        title="Download image"
      >
        <Download className="h-3.5 w-3.5 text-foreground" />
        <span className="text-[10px] font-medium text-foreground">Download</span>
      </button>
    </div>
  );
}

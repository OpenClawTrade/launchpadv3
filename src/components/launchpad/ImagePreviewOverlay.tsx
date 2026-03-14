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
          className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/70 backdrop-blur-sm border border-white/20 hover:bg-destructive/80 transition-colors z-10"
          title="Remove image"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      )}
      <button
        onClick={handleDownload}
        className="absolute bottom-1.5 right-1.5 p-2 rounded-lg bg-black/70 backdrop-blur-sm border border-white/20 hover:bg-primary/80 transition-colors z-10"
        title="Download image"
      >
        <Download className="h-4 w-4 text-white" />
      </button>
    </div>
  );
}

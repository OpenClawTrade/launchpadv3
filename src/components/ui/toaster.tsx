import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";

function ToastIcon({ variant }: { variant?: string }) {
  if (variant === "destructive") return <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />;
  if (variant === "success") return <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />;
  return <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />;
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <ToastIcon variant={variant} />
            <div className="grid gap-0.5 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

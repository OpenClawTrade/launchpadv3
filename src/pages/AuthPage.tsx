import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Kept only as a backwards-compatible route: /auth will immediately open the Privy modal.
export default function AuthPage() {
  const { login, isAuthenticated, isLoading, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;

    if (isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }

    // Ensure we are on the main UI while opening Privy.
    navigate("/", { replace: true });
    setTimeout(() => login(), 0);
  }, [ready, isAuthenticated, login, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          {isLoading ? "Loading..." : "Opening sign in..."}
        </p>
      </div>
    </div>
  );
}

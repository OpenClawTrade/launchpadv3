import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Wallet, Twitter, Mail, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import fautraLogo from "@/assets/fautra-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

export default function AuthPage() {
  const { login, isAuthenticated, isLoading, ready, solanaAddress } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";

  // Redirect to home if already authenticated
  useEffect(() => {
    if (ready && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [ready, isAuthenticated, navigate]);

  // Show loading state while Privy initializes
  if (!ready || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated, show redirect message (useEffect will handle redirect)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">
            {solanaAddress 
              ? `Welcome! Wallet: ${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)}`
              : "Redirecting..."
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-background-secondary items-center justify-center relative overflow-hidden border-r border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="relative z-10 text-center px-8">
          <div className="h-48 w-48 mx-auto mb-8 bg-primary/10 rounded-2xl flex items-center justify-center">
            <img 
              src={fautraLogo} 
              alt="FAUTRA" 
              className="h-24 w-24 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Welcome to FAUTRA
          </h1>
          <p className="text-base text-muted-foreground max-w-sm">
            The decentralized social platform built on Solana. Connect, share, and earn.
          </p>
        </div>
      </div>

      {/* Right side - Auth options */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          {/* Back button */}
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="lg:hidden flex justify-center mb-6">
            <img src={fautraLogo} alt="FAUTRA" className="h-12 w-12" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "signup" ? "Create an account" : "Welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === "signup" 
                ? "Join the future of social media"
                : "Log in to your FAUTRA account"
              }
            </p>
          </div>

          <div className="space-y-3">
            {/* Single unified login button - Privy handles all methods */}
            <Button
              onClick={login}
              className="w-full h-11 rounded-lg font-semibold text-sm"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect with Solana
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">
                  or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={login}
                variant="outline"
                className="h-10 rounded-lg font-medium text-sm"
              >
                <Twitter className="mr-2 h-4 w-4" />
                Twitter
              </Button>
              <Button
                onClick={login}
                variant="outline"
                className="h-10 rounded-lg font-medium text-sm"
              >
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-3">
              By signing up, you agree to the{" "}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>

            <div className="p-3 rounded-lg bg-secondary border border-border">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">🔐 Automatic Solana Wallet</span>
                <br />
                A wallet will be created for you automatically when you sign up.
              </p>
            </div>

            <div className="text-center pt-2">
              {mode === "signup" ? (
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/auth" className="text-primary hover:underline font-medium">
                    Log in
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/auth?mode=signup" className="text-primary hover:underline font-medium">
                    Sign up
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

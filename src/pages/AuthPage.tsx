import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Twitter, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import fautraLogo from "@/assets/fautra-logo.png";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthPage() {
  const { login, isAuthenticated, isLoading, ready, solanaAddress } = useAuth();
  const navigate = useNavigate();

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
          <p className="text-muted-foreground">Loading...</p>
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
          <p className="text-muted-foreground">
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
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-fautra-blue-hover opacity-90" />
        <div className="relative z-10 text-center px-8">
          <img 
            src={fautraLogo} 
            alt="FAUTRA" 
            className="h-64 w-64 mx-auto mb-8 brightness-0 invert drop-shadow-2xl"
          />
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            The Future of Social
          </h1>
          <p className="text-xl text-primary-foreground/80 max-w-md">
            Connect, share, and earn on the decentralized social platform built on Solana.
          </p>
        </div>
      </div>

      {/* Right side - Auth options */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center mb-8">
            <img src={fautraLogo} alt="FAUTRA" className="h-16 w-16" />
          </div>
          
          <div>
            <h2 className="text-4xl font-bold tracking-tight">
              Happening now
            </h2>
            <p className="text-2xl font-bold mt-8 mb-8">
              Join FAUTRA today.
            </p>
          </div>

          <div className="space-y-4">
            {/* Single unified login button - Privy handles all methods */}
            <Button
              onClick={login}
              className="w-full h-14 rounded-full font-bold text-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 transition-opacity"
            >
              <Wallet className="mr-2 h-5 w-5" />
              Connect with Solana
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={login}
                variant="outline"
                className="h-12 rounded-full font-medium"
              >
                <Twitter className="mr-2 h-4 w-4" />
                X / Twitter
              </Button>
              <Button
                onClick={login}
                variant="outline"
                className="h-12 rounded-full font-medium"
              >
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-4">
              By signing up, you agree to the{" "}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>

            <div className="pt-4 p-4 rounded-xl bg-secondary/50 border border-border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">🔐 Automatic Solana Wallet</strong>
                <br />
                A Solana wallet will be created for you automatically when you sign up with any method.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Wallet, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import fautraLogo from "@/assets/fautra-logo.png";
import { toast } from "sonner";

type AuthMode = "welcome" | "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSolanaLogin = async () => {
    setIsLoading(true);
    try {
      // This will connect to Privy with Solana
      toast.info("Solana wallet connection will be enabled with Privy integration");
      // Simulate for demo
      setTimeout(() => {
        localStorage.setItem("fautra_user", JSON.stringify({
          id: "sol_" + Date.now(),
          wallet: { address: "Sol...", chainType: "solana" }
        }));
        navigate("/");
      }, 1000);
    } catch (error) {
      toast.error("Failed to connect wallet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwitterLogin = async () => {
    setIsLoading(true);
    try {
      toast.info("X/Twitter login will be enabled with Privy integration");
      setTimeout(() => {
        localStorage.setItem("fautra_user", JSON.stringify({
          id: "tw_" + Date.now(),
          twitter: { username: "demo_user" }
        }));
        navigate("/");
      }, 1000);
    } catch (error) {
      toast.error("Failed to connect with X");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    
    setIsLoading(true);
    try {
      // This will use Privy email auth
      setTimeout(() => {
        localStorage.setItem("fautra_user", JSON.stringify({
          id: "email_" + Date.now(),
          email,
          name: name || email.split("@")[0]
        }));
        toast.success(mode === "signup" ? "Account created!" : "Welcome back!");
        navigate("/");
      }, 1000);
    } catch (error) {
      toast.error("Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "welcome") {
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
              {/* Solana Wallet - Primary */}
              <Button
                onClick={handleSolanaLogin}
                disabled={isLoading}
                className="w-full h-12 rounded-full font-bold text-base bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 transition-opacity"
              >
                <Wallet className="mr-2 h-5 w-5" />
                Sign in with Solana
              </Button>

              {/* X/Twitter */}
              <Button
                onClick={handleTwitterLogin}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 rounded-full font-bold text-base"
              >
                <Twitter className="mr-2 h-5 w-5" />
                Sign in with X
              </Button>

              {/* Email */}
              <Button
                onClick={() => setMode("signup")}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 rounded-full font-bold text-base"
              >
                <Mail className="mr-2 h-5 w-5" />
                Sign up with email
              </Button>

              <p className="text-xs text-muted-foreground">
                By signing up, you agree to the{" "}
                <a href="#" className="text-primary hover:underline">Terms of Service</a>
                {" "}and{" "}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>
                , including{" "}
                <a href="#" className="text-primary hover:underline">Cookie Use</a>.
              </p>

              <Separator className="my-6" />

              <p className="text-lg font-bold">
                Already have an account?
              </p>

              <Button
                onClick={() => setMode("login")}
                variant="outline"
                className="w-full h-12 rounded-full font-bold text-base text-primary border-primary hover:bg-primary/5"
              >
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login or Signup form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border p-8 shadow-xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={() => setMode("welcome")}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <img src={fautraLogo} alt="FAUTRA" className="h-8 w-8 mx-auto" />
          </div>

          <h1 className="text-2xl font-bold mb-6">
            {mode === "login" ? "Sign in to FAUTRA" : "Create your account"}
          </h1>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-12 rounded-lg mt-1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 rounded-lg mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-lg mt-1"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full font-bold text-base mt-6"
            >
              {isLoading ? "Loading..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <Separator className="my-6" />

          {/* Alternative methods */}
          <div className="space-y-3">
            <Button
              onClick={handleSolanaLogin}
              disabled={isLoading}
              variant="outline"
              className="w-full h-11 rounded-full"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Continue with Solana
            </Button>
            <Button
              onClick={handleTwitterLogin}
              disabled={isLoading}
              variant="outline"
              className="w-full h-11 rounded-full"
            >
              <Twitter className="mr-2 h-4 w-4" />
              Continue with X
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button 
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button 
                  onClick={() => setMode("login")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SolPriceDisplay } from "@/components/layout/SolPriceDisplay";
import { 
  Key, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Rocket, 
  DollarSign, 
  Activity,
  ExternalLink,
  RefreshCw,
  Trash2,
  Wallet,
  TrendingUp,
  BarChart3,
  Trophy,
  Menu
} from "lucide-react";
import { XLogo } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ApiLeaderboard } from "@/components/api/ApiLeaderboard";

import clawLogo from "@/assets/claw-logo.png";
const HEADER_LOGO_SRC = clawLogo;

interface ApiAccount {
  id: string;
  wallet_address: string;
  api_key_prefix: string;
  fee_wallet_address: string;
  status: string;
  total_fees_earned: number | null;
  total_fees_paid_out: number | null;
  created_at: string;
}

interface Launchpad {
  id: string;
  name: string;
  subdomain: string | null;
  status: string;
  total_volume_sol: number | null;
  total_fees_sol: number | null;
  created_at: string;
}

interface Analytics {
  period: { label: string };
  summary: {
    totalFees: number;
    totalTrades: number;
    totalVolume: number;
    apiCalls: number;
  };
  dailyBreakdown: Array<{ date: string; fees: number; volume: number; trades: number }>;
}

interface PendingFees {
  pendingAmount: number;
  pendingCount: number;
}

export default function ApiDashboardPage() {
  const navigate = useNavigate();
  const { solanaAddress, isAuthenticated, login } = useAuth();
  const walletAddress = solanaAddress;
  const [account, setAccount] = useState<ApiAccount | null>(null);
  const [launchpads, setLaunchpads] = useState<Launchpad[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [feeWallet, setFeeWallet] = useState(solanaAddress || "");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pendingFees, setPendingFees] = useState<PendingFees | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      fetchAccount();
      if (!feeWallet) {
        setFeeWallet(walletAddress);
      }
    } else {
      setLoading(false);
    }
  }, [walletAddress]);

  const fetchAccount = async () => {
    if (!walletAddress) return;
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-account?wallet=${walletAddress}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const accountData = await response.json();
      
      if (accountData.exists && accountData.account) {
        setAccount(accountData.account);
        setFeeWallet(accountData.account.fee_wallet_address);
        
        const lpResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-launchpad?wallet=${walletAddress}`,
          {
            headers: {
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        const lpData = await lpResponse.json();
        setLaunchpads(lpData.launchpads || []);

        fetchAnalytics();
        fetchPendingFees();
      }
    } catch (error) {
      console.error("Error fetching account:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!walletAddress) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-analytics?wallet=${walletAddress}&period=7d`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const data = await response.json();
      if (!data.error) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const fetchPendingFees = async () => {
    if (!walletAddress) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-claim-fees?wallet=${walletAddress}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const data = await response.json();
      if (!data.error) {
        setPendingFees(data);
      }
    } catch (error) {
      console.error("Error fetching pending fees:", error);
    }
  };

  const claimFees = async () => {
    if (!walletAddress || !pendingFees || pendingFees.pendingAmount <= 0) return;
    
    setClaiming(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-claim-fees`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ walletAddress }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Claimed ${data.claimedAmount.toFixed(4)} SOL!`);
        fetchAccount();
        fetchPendingFees();
      } else {
        toast.error(data.error || "Failed to claim fees");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to claim fees";
      toast.error(errorMessage);
    } finally {
      setClaiming(false);
    }
  };

  const createAccount = async () => {
    if (!walletAddress) return;
    
    setCreating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-account`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress,
            feeWalletAddress: feeWallet || walletAddress,
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setNewApiKey(data.apiKey);
        toast.success("API account created!");
        fetchAccount();
      } else {
        toast.error(data.error || "Failed to create account");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create account";
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const regenerateApiKey = async () => {
    if (!walletAddress) return;
    
    setCreating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-account`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress,
            action: "regenerate",
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setNewApiKey(data.apiKey);
        toast.success("API key regenerated!");
        fetchAccount();
      } else {
        toast.error(data.error || "Failed to regenerate key");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to regenerate key";
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const copyApiKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      toast.success("API key copied!");
    }
  };

  const deleteLaunchpad = async (id: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-launchpad?id=${id}&wallet=${walletAddress}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast.success("Launchpad deleted");
        setLaunchpads(launchpads.filter(lp => lp.id !== id));
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete";
      toast.error(errorMessage);
    }
  };

  // Header component matching gate-theme
  const ApiHeader = () => (
    <header className="gate-header">
      <div className="gate-header-inner">
        <Link to="/" className="gate-logo" aria-label="Claw Mode">
          <img
            src={HEADER_LOGO_SRC}
            alt="Claw Mode"
            className="h-8 w-8 rounded-lg object-cover"
            loading="eager"
          />
          <span className="text-lg font-bold">CLAW</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2">
          <Link to="/">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium">
              Home
            </Button>
          </Link>
          <Link to="/trending">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium">
              Trending Narratives
            </Button>
          </Link>
          <Link to="/api">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-sm font-medium">
              API
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <a 
            href="https://x.com/buildtuna" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-colors"
            title="Follow us on X"
          >
            <XLogo className="h-4 w-4 text-muted-foreground hover:text-foreground" weight="fill" />
          </a>
          <SolPriceDisplay />
          
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm" className="h-10 w-10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-card border-border">
              <nav className="flex flex-col gap-2 mt-8">
                <Link to="/" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <span className="text-foreground text-sm font-medium">Home</span>
                </Link>
                <Link to="/trending" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <span className="text-foreground text-sm font-medium">Trending Narratives</span>
                </Link>
                <Link to="/api" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <span className="text-primary-foreground text-sm font-medium">API</span>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );

  // Not authenticated - show public API info with connect option
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen" style={{ background: "#141414" }}>
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
        <ApiHeader />
        <div className="max-w-6xl mx-auto p-4 pt-8 space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-foreground">🦞 Claw Mode API Platform</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Build your own token launchpad and earn 1% of every trade
            </p>
          </div>

          {/* Key Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="gate-card">
              <CardHeader className="pb-2">
                <DollarSign className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg text-foreground">Earn Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get 1% of all trading fees on tokens launched through your API or launchpad.
                </p>
              </CardContent>
            </Card>
            
            <Card className="gate-card">
              <CardHeader className="pb-2">
                <Rocket className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg text-foreground">Quick Launch</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Launch tokens with a single API call. Fully on-chain via Meteora bonding curves.
                </p>
              </CardContent>
            </Card>
            
            <Card className="gate-card">
              <CardHeader className="pb-2">
                <Activity className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg text-foreground">Full Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Track volume, fees earned, and claim payouts directly to your wallet.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Fee Structure */}
          <Card className="gate-card">
            <CardHeader>
              <CardTitle className="text-foreground">Fee Structure</CardTitle>
              <CardDescription>How revenue sharing works</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 text-center">
                  <p className="text-3xl font-bold text-primary">2%</p>
                  <p className="text-sm text-muted-foreground">Total Trading Fee</p>
                </div>
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 text-center">
                  <p className="text-3xl font-bold text-primary">1%</p>
                  <p className="text-sm text-muted-foreground">Your Share</p>
                </div>
                <div className="bg-secondary/50 p-4 rounded-lg border border-border text-center">
                  <p className="text-3xl font-bold text-muted-foreground">1%</p>
                  <p className="text-sm text-muted-foreground">Platform Share</p>
                </div>
                <div className="bg-secondary/50 p-4 rounded-lg border border-border text-center">
                  <p className="text-3xl font-bold text-muted-foreground">0.01</p>
                  <p className="text-sm text-muted-foreground">SOL Min Claim</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="gate-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Get Started
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your wallet to create an API account and get your key instantly.
                </p>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => login()}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet to Start
                </Button>
              </CardContent>
            </Card>

            <Card className="gate-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-primary" />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Complete API documentation with examples in TypeScript, Python, and cURL.
                </p>
                <Link to="/api/docs">
                  <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10">
                    View Full Documentation →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* API Endpoints Preview */}
          <Card className="gate-card">
            <CardHeader>
              <CardTitle className="text-foreground">Available Endpoints</CardTitle>
              <CardDescription>Core API capabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                  <Badge className="bg-primary text-primary-foreground">POST</Badge>
                  <code className="text-sm text-foreground font-mono">/api-launch-token</code>
                  <span className="text-sm text-muted-foreground">— Launch a new token with automatic pool creation</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                  <Badge className="bg-primary text-primary-foreground">POST</Badge>
                  <code className="text-sm text-foreground font-mono">/api-swap</code>
                  <span className="text-sm text-muted-foreground">— Get swap quotes for trading</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                  <Badge variant="secondary" className="bg-accent text-accent-foreground">GET</Badge>
                  <code className="text-sm text-foreground font-mono">/api-swap/pools</code>
                  <span className="text-sm text-muted-foreground">— List all active trading pools</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                  <Badge variant="secondary" className="bg-accent text-accent-foreground">GET</Badge>
                  <code className="text-sm text-foreground font-mono">/api-swap/pool</code>
                  <span className="text-sm text-muted-foreground">— Get detailed pool information</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="gate-card">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Top API Integrators
              </CardTitle>
              <CardDescription>Developers earning the most from the API</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiLeaderboard />
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center py-8">
            <Button 
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
              onClick={() => login()}
            >
              <Wallet className="w-5 h-5 mr-2" />
              Create Your API Account
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              Free to create • Start earning immediately
            </p>
          </div>
        </div>
      </div>
    </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#141414" }}>
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="md:ml-[160px] flex flex-col min-h-screen">
          <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <div className="flex items-center justify-center pt-20">
            <div className="w-8 h-8 border-2 border-transparent border-t-primary rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // No account yet - show signup
  if (!account) {
    return (
      <div className="min-h-screen" style={{ background: "#141414" }}>
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="md:ml-[160px] flex flex-col min-h-screen">
          <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <div className="max-w-2xl mx-auto p-4 pt-8">
            <Card className="gate-card">
              <CardHeader className="text-center">
                <Rocket className="w-16 h-16 mx-auto mb-4 text-primary" />
                <CardTitle className="text-2xl text-foreground">Create Your API Account</CardTitle>
                <CardDescription className="text-base">
                  Build custom launchpads and earn 1% on every trade
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-secondary/50 rounded-lg p-4 space-y-3 border border-border">
                  <h3 className="font-semibold text-foreground">What you get:</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      1% of all trading fees on tokens launched via your API
                    </li>
                    <li className="flex items-center gap-2">
                      <Rocket className="w-4 h-4 text-primary" />
                      AI-generated launchpad ready in minutes
                    </li>
                    <li className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-primary" />
                      Free subdomain (*.clawmode.fun) or your own custom domain
                    </li>
                    <li className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Full analytics and fee tracking dashboard
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="feeWallet" className="text-muted-foreground">Fee Wallet Address</Label>
                  <Input
                    id="feeWallet"
                    placeholder="Enter wallet address for fee payouts"
                    value={feeWallet}
                    onChange={(e) => setFeeWallet(e.target.value)}
                    className="bg-secondary border-border text-foreground font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pre-filled with your embedded wallet. Change if you want fees sent elsewhere.
                  </p>
                </div>

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                  onClick={createAccount}
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create API Account"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* API Key Modal */}
          <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey(null)}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">🎉 Your API Key</DialogTitle>
                <DialogDescription>
                  Store this key securely. It won't be shown again!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={newApiKey || ""}
                    readOnly
                    className="pr-20 font-mono text-sm bg-secondary border-border text-foreground"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={copyApiKey}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-destructive">
                  ⚠️ This is the only time you'll see this key. Copy it now!
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // Has account - show dashboard
  return (
    <div className="min-h-screen" style={{ background: "#141414" }}>
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
      <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
      
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Dashboard</h1>
            <p className="text-muted-foreground">Manage your launchpads and track earnings</p>
          </div>
          <Button 
            onClick={() => navigate("/api/builder")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Launchpad
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-card border border-border p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="gate-card">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">API Key</div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono text-foreground">{account.api_key_prefix}...</code>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground">
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground">Regenerate API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will invalidate your current API key. Any integrations using it will stop working.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-secondary border-border text-foreground">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={regenerateApiKey} className="bg-primary text-primary-foreground">
                            Regenerate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>

              <Card className="gate-card">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Total Earned</div>
                  <div className="text-2xl font-bold text-primary">
                    {(account.total_fees_earned || 0).toFixed(4)} SOL
                  </div>
                </CardContent>
              </Card>

              <Card className="gate-card">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Pending</div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-warning">
                      {(pendingFees?.pendingAmount || 0).toFixed(4)} SOL
                    </div>
                    {(pendingFees?.pendingAmount || 0) > 0 && (
                      <Button
                        size="sm"
                        onClick={claimFees}
                        disabled={claiming}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs"
                      >
                        {claiming ? "..." : "Claim"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="gate-card">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Paid Out</div>
                  <div className="text-2xl font-bold text-foreground">
                    {(account.total_fees_paid_out || 0).toFixed(4)} SOL
                  </div>
                </CardContent>
              </Card>

              <Card className="gate-card">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Launchpads</div>
                  <div className="text-2xl font-bold text-foreground">{launchpads.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Analytics Section */}
            {analytics && (
              <Card className="gate-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        7-Day Analytics
                      </CardTitle>
                      <CardDescription>Performance overview for your launchpads</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                      <div className="text-sm text-muted-foreground">Volume</div>
                      <div className="text-xl font-bold text-foreground flex items-center gap-1">
                        {analytics.summary.totalVolume.toFixed(2)} SOL
                        <TrendingUp className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                      <div className="text-sm text-muted-foreground">Fees Earned</div>
                      <div className="text-xl font-bold text-primary">
                        {analytics.summary.totalFees.toFixed(4)} SOL
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                      <div className="text-sm text-muted-foreground">Trades</div>
                      <div className="text-xl font-bold text-foreground">
                        {analytics.summary.totalTrades}
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                      <div className="text-sm text-muted-foreground">API Calls</div>
                      <div className="text-xl font-bold text-foreground">
                        {analytics.summary.apiCalls}
                      </div>
                    </div>
                  </div>

                  {/* Daily breakdown chart */}
                  {analytics.dailyBreakdown.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm text-muted-foreground mb-2">Daily Fees</div>
                      <div className="flex items-end gap-1 h-20">
                        {analytics.dailyBreakdown.slice(-7).map((day) => {
                          const maxFees = Math.max(...analytics.dailyBreakdown.map(d => d.fees), 0.0001);
                          const height = (day.fees / maxFees) * 100;
                          return (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                              <div 
                                className="w-full bg-primary/50 rounded-t transition-all hover:bg-primary"
                                style={{ height: `${Math.max(height, 4)}%` }}
                                title={`${day.date}: ${day.fees.toFixed(4)} SOL`}
                              />
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(day.date).getDate()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Launchpads */}
            <Card className="gate-card">
              <CardHeader>
                <CardTitle className="text-foreground">Your Launchpads</CardTitle>
                <CardDescription>Manage your custom token launchpads</CardDescription>
              </CardHeader>
              <CardContent>
                {launchpads.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No launchpads yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-border text-foreground hover:bg-secondary"
                      onClick={() => navigate("/api/builder")}
                    >
                      Create your first launchpad
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {launchpads.map((lp) => (
                      <div 
                        key={lp.id} 
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{lp.name}</span>
                            <Badge 
                              variant={lp.status === "live" ? "default" : "secondary"}
                              className={lp.status === "live" ? "bg-primary" : "bg-secondary"}
                            >
                              {lp.status}
                            </Badge>
                          </div>
                          {lp.subdomain && (
                            <a 
                            href={`https://${lp.subdomain}.clawmode.fun`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              {lp.subdomain}.clawmode.fun
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm hidden sm:block">
                            <div className="text-muted-foreground">Volume</div>
                            <div className="text-foreground">{(lp.total_volume_sol || 0).toFixed(2)} SOL</div>
                          </div>
                          <div className="text-right text-sm hidden sm:block">
                            <div className="text-muted-foreground">Fees</div>
                            <div className="text-primary">{(lp.total_fees_sol || 0).toFixed(4)} SOL</div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate(`/api/builder?id=${lp.id}`)}
                              className="border-border text-foreground hover:bg-secondary"
                            >
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-foreground">Delete Launchpad?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{lp.name}" and remove its subdomain.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-secondary border-border text-foreground">Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteLaunchpad(lp.id)}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <ApiLeaderboard currentWallet={walletAddress} />
          </TabsContent>
        </Tabs>

        {/* New API Key Modal */}
        <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">🔑 New API Key</DialogTitle>
              <DialogDescription>
                Store this key securely. It won't be shown again!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={newApiKey || ""}
                  readOnly
                  className="pr-20 font-mono text-sm bg-secondary border-border text-foreground"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={copyApiKey}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-destructive">
                ⚠️ This is the only time you'll see this key. Copy it now!
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </div>
  );
}

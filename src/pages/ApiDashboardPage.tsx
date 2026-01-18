import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
  Trash2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export default function ApiDashboardPage() {
  const navigate = useNavigate();
  const { solanaAddress, isAuthenticated } = useAuth();
  const walletAddress = solanaAddress;
  const [account, setAccount] = useState<ApiAccount | null>(null);
  const [launchpads, setLaunchpads] = useState<Launchpad[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [feeWallet, setFeeWallet] = useState("");

  useEffect(() => {
    if (walletAddress) {
      fetchAccount();
    } else {
      setLoading(false);
    }
  }, [walletAddress]);

  const fetchAccount = async () => {
    if (!walletAddress) return;
    
    try {
      // Get account
      const { data } = await supabase.functions.invoke("api-account", {
        method: "GET",
        body: null,
        headers: { "Content-Type": "application/json" },
      });

      // Parse from query params approach - use fetch directly
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
        
        // Fetch launchpads
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
      }
    } catch (error) {
      console.error("Error fetching account:", error);
    } finally {
      setLoading(false);
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
    } catch (error: any) {
      toast.error(error?.message || "Failed to create account");
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
    } catch (error: any) {
      toast.error(error?.message || "Failed to regenerate key");
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
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Key className="w-12 h-12 mx-auto mb-4 text-primary" />
            <CardTitle>API Developer Dashboard</CardTitle>
            <CardDescription>
              Connect your wallet to access the API platform
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            Please connect your wallet to continue.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-transparent border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // No account yet - show signup
  if (!account) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <Rocket className="w-16 h-16 mx-auto mb-4 text-primary" />
              <CardTitle className="text-2xl">Create Your API Account</CardTitle>
              <CardDescription className="text-base">
                Build custom launchpads and earn 1.5% on every trade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">What you get:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    1.5% of all trading fees on your launchpads
                  </li>
                  <li className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-primary" />
                    Custom branded launchpad domains (*.ai67x.fun)
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Full analytics and fee tracking dashboard
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <Label htmlFor="feeWallet">Fee Wallet Address (optional)</Label>
                <Input
                  id="feeWallet"
                  placeholder={walletAddress || "Leave empty to use connected wallet"}
                  value={feeWallet}
                  onChange={(e) => setFeeWallet(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Where your 1.5% fees will be sent. Defaults to your connected wallet.
                </p>
              </div>

              <Button 
                className="w-full" 
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🎉 Your API Key</DialogTitle>
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
                  className="pr-20 font-mono text-sm"
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
    );
  }

  // Has account - show dashboard
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">API Dashboard</h1>
            <p className="text-muted-foreground">Manage your launchpads and track earnings</p>
          </div>
          <Button onClick={() => navigate("/api/builder")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Launchpad
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">API Key</div>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm font-mono">{account.api_key_prefix}...</code>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-6 w-6">
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will invalidate your current API key. Any integrations using it will stop working.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={regenerateApiKey}>
                        Regenerate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Earned</div>
              <div className="text-2xl font-bold text-green-500">
                {(account.total_fees_earned || 0).toFixed(4)} SOL
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Paid Out</div>
              <div className="text-2xl font-bold">
                {(account.total_fees_paid_out || 0).toFixed(4)} SOL
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Launchpads</div>
              <div className="text-2xl font-bold">{launchpads.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Launchpads */}
        <Card>
          <CardHeader>
            <CardTitle>Your Launchpads</CardTitle>
            <CardDescription>Manage your custom token launchpads</CardDescription>
          </CardHeader>
          <CardContent>
            {launchpads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No launchpads yet</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
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
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{lp.name}</span>
                        <Badge variant={lp.status === "live" ? "default" : "secondary"}>
                          {lp.status}
                        </Badge>
                      </div>
                      {lp.subdomain && (
                        <a 
                          href={`https://${lp.subdomain}.ai67x.fun`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {lp.subdomain}.ai67x.fun
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">Volume</div>
                        <div>{(lp.total_volume_sol || 0).toFixed(2)} SOL</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">Fees</div>
                        <div className="text-green-500">{(lp.total_fees_sol || 0).toFixed(4)} SOL</div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/api/builder?id=${lp.id}`)}
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Launchpad?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{lp.name}" and remove its subdomain.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteLaunchpad(lp.id)}
                                className="bg-destructive text-destructive-foreground"
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

        {/* New API Key Modal */}
        <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🔑 New API Key</DialogTitle>
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
                  className="pr-20 font-mono text-sm"
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

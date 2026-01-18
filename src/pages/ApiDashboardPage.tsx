import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/AppHeader";
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
  Wallet
} from "lucide-react";
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
  const { solanaAddress, isAuthenticated, login } = useAuth();
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

  // Not authenticated - show connect prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <AppHeader showBack backLabel="API Platform" />
        <div className="flex items-center justify-center p-4 pt-20">
          <Card className="max-w-md w-full bg-[#12121a] border-[#1a1a1f]">
            <CardHeader className="text-center">
              <Key className="w-12 h-12 mx-auto mb-4 text-purple-400" />
              <CardTitle className="text-white">API Developer Dashboard</CardTitle>
              <CardDescription>
                Connect your wallet to access the API platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-gray-400 text-sm">
                Build custom launchpads and earn 1.5% on every trade
              </p>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => login()}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <AppHeader showBack backLabel="API Platform" />
        <div className="flex items-center justify-center pt-20">
          <div className="w-8 h-8 border-2 border-transparent border-t-purple-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // No account yet - show signup
  if (!account) {
    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        <AppHeader showBack backLabel="API Platform" />
        <div className="max-w-2xl mx-auto p-4 pt-8">
          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardHeader className="text-center">
              <Rocket className="w-16 h-16 mx-auto mb-4 text-purple-400" />
              <CardTitle className="text-2xl text-white">Create Your API Account</CardTitle>
              <CardDescription className="text-base">
                Build custom launchpads and earn 1.5% on every trade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-[#1a1a1f] rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-white">What you get:</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    1.5% of all trading fees on your launchpads
                  </li>
                  <li className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-purple-400" />
                    Custom branded launchpad domains (*.ai67x.fun)
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Full analytics and fee tracking dashboard
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <Label htmlFor="feeWallet" className="text-gray-300">Fee Wallet Address (optional)</Label>
                <Input
                  id="feeWallet"
                  placeholder={walletAddress || "Leave empty to use connected wallet"}
                  value={feeWallet}
                  onChange={(e) => setFeeWallet(e.target.value)}
                  className="bg-[#1a1a1f] border-[#2a2a3f] text-white"
                />
                <p className="text-xs text-gray-500">
                  Where your 1.5% fees will be sent. Defaults to your connected wallet.
                </p>
              </div>

              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700" 
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
          <DialogContent className="bg-[#12121a] border-[#1a1a1f]">
            <DialogHeader>
              <DialogTitle className="text-white">🎉 Your API Key</DialogTitle>
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
                  className="pr-20 font-mono text-sm bg-[#1a1a1f] border-[#2a2a3f] text-white"
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
              <p className="text-sm text-red-400">
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
    <div className="min-h-screen bg-[#0a0a0c]">
      <AppHeader showBack backLabel="API Platform" />
      
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4">
          <div>
            <h1 className="text-2xl font-bold text-white">API Dashboard</h1>
            <p className="text-gray-400">Manage your launchpads and track earnings</p>
          </div>
          <Button 
            onClick={() => navigate("/api/builder")}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Launchpad
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-400">API Key</div>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm font-mono text-gray-300">{account.api_key_prefix}...</code>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400">
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#12121a] border-[#1a1a1f]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Regenerate API Key?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will invalidate your current API key. Any integrations using it will stop working.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-[#1a1a1f] border-[#2a2a3f] text-white">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={regenerateApiKey} className="bg-purple-600">
                        Regenerate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-400">Total Earned</div>
              <div className="text-2xl font-bold text-green-500">
                {(account.total_fees_earned || 0).toFixed(4)} SOL
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-400">Paid Out</div>
              <div className="text-2xl font-bold text-white">
                {(account.total_fees_paid_out || 0).toFixed(4)} SOL
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardContent className="pt-6">
              <div className="text-sm text-gray-400">Launchpads</div>
              <div className="text-2xl font-bold text-white">{launchpads.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Launchpads */}
        <Card className="bg-[#12121a] border-[#1a1a1f]">
          <CardHeader>
            <CardTitle className="text-white">Your Launchpads</CardTitle>
            <CardDescription>Manage your custom token launchpads</CardDescription>
          </CardHeader>
          <CardContent>
            {launchpads.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No launchpads yet</p>
                <Button 
                  variant="outline" 
                  className="mt-4 border-[#2a2a3f] text-gray-300 hover:bg-[#1a1a1f]"
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
                    className="flex items-center justify-between p-4 border border-[#1a1a1f] rounded-lg hover:bg-[#1a1a1f]/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{lp.name}</span>
                        <Badge 
                          variant={lp.status === "live" ? "default" : "secondary"}
                          className={lp.status === "live" ? "bg-green-600" : "bg-gray-600"}
                        >
                          {lp.status}
                        </Badge>
                      </div>
                      {lp.subdomain && (
                        <a 
                          href={`https://${lp.subdomain}.ai67x.fun`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple-400 hover:underline flex items-center gap-1"
                        >
                          {lp.subdomain}.ai67x.fun
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm hidden sm:block">
                        <div className="text-gray-500">Volume</div>
                        <div className="text-gray-300">{(lp.total_volume_sol || 0).toFixed(2)} SOL</div>
                      </div>
                      <div className="text-right text-sm hidden sm:block">
                        <div className="text-gray-500">Fees</div>
                        <div className="text-green-500">{(lp.total_fees_sol || 0).toFixed(4)} SOL</div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/api/builder?id=${lp.id}`)}
                          className="border-[#2a2a3f] text-gray-300 hover:bg-[#1a1a1f]"
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#12121a] border-[#1a1a1f]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">Delete Launchpad?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{lp.name}" and remove its subdomain.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-[#1a1a1f] border-[#2a2a3f] text-white">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteLaunchpad(lp.id)}
                                className="bg-red-600 hover:bg-red-700"
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
          <DialogContent className="bg-[#12121a] border-[#1a1a1f]">
            <DialogHeader>
              <DialogTitle className="text-white">🔑 New API Key</DialogTitle>
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
                  className="pr-20 font-mono text-sm bg-[#1a1a1f] border-[#2a2a3f] text-white"
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
              <p className="text-sm text-red-400">
                ⚠️ This is the only time you'll see this key. Copy it now!
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

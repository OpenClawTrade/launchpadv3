import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, Loader2, Search, Coins } from "lucide-react";

interface LinkedToken {
  linkId: string;
  id: string;
  name: string;
  ticker: string;
  mint_address: string;
  image_url: string | null;
  price_sol: number | null;
  status: string;
  linkedAt: string;
}

interface TokenAssociationManagerProps {
  launchpadId: string;
  walletAddress: string;
}

export function TokenAssociationManager({ launchpadId, walletAddress }: TokenAssociationManagerProps) {
  const [tokens, setTokens] = useState<LinkedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [mintAddress, setMintAddress] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (launchpadId && walletAddress) {
      fetchTokens();
    }
  }, [launchpadId, walletAddress]);

  const fetchTokens = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-tokens?launchpadId=${launchpadId}&wallet=${walletAddress}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error("Error fetching tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToken = async () => {
    if (!mintAddress.trim()) {
      toast.error("Please enter a token mint address");
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-tokens`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            launchpadId,
            mintAddress: mintAddress.trim(),
            wallet: walletAddress,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Token added to launchpad!");
        setMintAddress("");
        fetchTokens();
      } else {
        toast.error(data.error || "Failed to add token");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to add token");
    } finally {
      setAdding(false);
    }
  };

  const removeToken = async (linkId: string) => {
    setRemovingId(linkId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-tokens?linkId=${linkId}&wallet=${walletAddress}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Token removed from launchpad");
        setTokens(tokens.filter(t => t.linkId !== linkId));
      } else {
        toast.error(data.error || "Failed to remove token");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove token");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#12121a] border-[#1a1a1f]">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#12121a] border-[#1a1a1f]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <Coins className="w-4 h-4 text-yellow-400" />
          Linked Tokens
        </CardTitle>
        <CardDescription>
          Tokens featured on this launchpad (trading sends x-launchpad-id header)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add token input */}
        <div className="flex gap-2">
          <Input
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            placeholder="Token mint address..."
            className="flex-1 bg-[#1a1a1f] border-[#2a2a3f] text-white text-sm"
          />
          <Button
            onClick={addToken}
            disabled={adding || !mintAddress.trim()}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        {/* Token list */}
        {tokens.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            No tokens linked yet. Add a token mint address above.
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.linkId}
                className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1f] border border-[#2a2a3f]"
              >
                <div className="flex items-center gap-3">
                  {token.image_url ? (
                    <img
                      src={token.image_url}
                      alt={token.ticker}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-purple-400">
                        {token.ticker?.slice(0, 2)}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{token.name}</span>
                      <Badge variant="outline" className="text-[10px] border-[#2a2a3f] text-gray-400">
                        ${token.ticker}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {token.mint_address?.slice(0, 8)}...{token.mint_address?.slice(-6)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {token.price_sol && (
                    <span className="text-xs text-gray-400">
                      {token.price_sol.toFixed(8)} SOL
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                    onClick={() => removeToken(token.linkId)}
                    disabled={removingId === token.linkId}
                  >
                    {removingId === token.linkId ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

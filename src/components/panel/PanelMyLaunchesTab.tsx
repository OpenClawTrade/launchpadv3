import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Twitter, Loader2, DollarSign, ExternalLink, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";

function LinkXButton() {
  const { linkTwitter } = usePrivy();
  const [linking, setLinking] = useState(false);

  return (
    <Button
      onClick={async () => {
        setLinking(true);
        try {
          await linkTwitter();
        } catch {
          // user cancelled
        } finally {
          setLinking(false);
        }
      }}
      disabled={linking}
      className="gap-2 font-mono bg-green-500 hover:bg-green-600 text-black border-0"
    >
      {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Twitter className="h-4 w-4" />}
      Link X Account
    </Button>
  );
}


interface LaunchedToken {
  id: string;
  name: string;
  ticker: string;
  mint_address: string | null;
  image_url: string | null;
  status: string | null;
  total_fees_earned: number | null;
  total_fees_claimed: number | null;
  created_at: string | null;
}

export default function PanelMyLaunchesTab() {
  const { user } = useAuth();
  const twitterUsername = user?.twitter?.username;

  // Fetch tokens launched by this X username
  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["my-launches", twitterUsername],
    enabled: !!twitterUsername,
    queryFn: async () => {
      // Search agent_social_posts for tokens where post_author matches
      const { data: posts, error } = await supabase
        .from("agent_social_posts")
        .select("fun_token_id")
        .eq("post_author", twitterUsername!)
        .not("fun_token_id", "is", null);

      if (error || !posts?.length) return [];

      const tokenIds = [...new Set(posts.map((p) => p.fun_token_id).filter(Boolean))];

      // Also check claw_tokens via agent_social_posts
      const { data: funTokens } = await supabase
        .from("fun_tokens" as any)
        .select("id, name, ticker, mint_address, image_url, status, total_fees_earned, total_fees_claimed, created_at")
        .in("id", tokenIds);

      return ((funTokens || []) as unknown as LaunchedToken[]);
    },
  });

  // Also check claw tokens
  const { data: clawTokens = [] } = useQuery({
    queryKey: ["my-claw-launches", twitterUsername],
    enabled: !!twitterUsername,
    queryFn: async () => {
      const { data } = await supabase
        .from("claw_tokens")
        .select("id, name, ticker, mint_address, image_url, status, total_fees_earned, total_fees_claimed, created_at")
        .eq("creator_wallet", user?.wallet?.address || "___none___");

      return (data || []) as LaunchedToken[];
    },
  });

  const allTokens = [...tokens, ...clawTokens];
  // Creator gets 30% of total fees earned
  const CREATOR_SHARE = 0.3;
  const totalEarned = allTokens.reduce((s, t) => s + (t.total_fees_earned || 0) * CREATOR_SHARE, 0);
  const totalClaimed = allTokens.reduce((s, t) => s + (t.total_fees_claimed || 0), 0);

  if (!twitterUsername) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto pb-8">
        <div className="text-center py-10">
          <Twitter className="h-12 w-12 mx-auto mb-4 opacity-40" style={{ color: "#4ade80" }} />
          <h3 className="text-lg font-bold font-mono mb-2" style={{ color: "#4ade80" }}>
            Link Your X Account
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your X (Twitter) account to see tokens you've launched via !clawmode and claim your trading fees.
          </p>
          <LinkXButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold font-mono text-sm" style={{ color: "#4ade80" }}>
            MY LAUNCHES
          </h3>
          <p className="text-xs text-muted-foreground">@{twitterUsername}</p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          {allTokens.length} token{allTokens.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Summary */}
      {allTokens.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 bg-white/5 border-white/10 text-center">
            <p className="text-lg font-bold font-mono" style={{ color: "#4ade80" }}>
              {totalEarned.toFixed(4)}
            </p>
            <p className="text-[10px] text-muted-foreground">Your Share (SOL)</p>
          </Card>
          <Card className="p-3 bg-white/5 border-white/10 text-center">
            <p className="text-lg font-bold font-mono" style={{ color: "#4ade80" }}>
              {totalClaimed.toFixed(4)}
            </p>
            <p className="text-[10px] text-muted-foreground">Total Claimed (SOL)</p>
          </Card>
        </div>
      )}

      {/* Token List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : allTokens.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(51,65,85,0.35)",
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.12)" }}
          >
            <Rocket className="h-6 w-6 text-[#F97316]/60" />
          </div>
          <p className="text-sm font-medium text-[#CBD5E1] mb-1">No tokens launched yet</p>
          <p className="text-xs text-[#64748B] mb-4 max-w-xs mx-auto leading-relaxed">
            Reply to any post on X with <code className="text-[#F97316] font-mono text-[11px]">@clawmode !clawmode</code> followed by your token idea
          </p>
          <a
            href="https://x.com/clawmode"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
          >
            Launch via @clawmode →
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {allTokens.map((token) => (
            <Card key={token.id} className="p-3 flex items-center gap-3 bg-white/[0.02] border-white/10">
              <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                {token.image_url ? (
                  <img src={token.image_url} alt="" className="h-10 w-10 object-cover" />
                ) : (
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {token.name} <span className="text-muted-foreground">${token.ticker}</span>
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{((token.total_fees_earned || 0) * CREATOR_SHARE).toFixed(4)} SOL earned</span>
                  {token.mint_address && (
                    <a
                      href={`https://solscan.io/token/${token.mint_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                {token.status || "active"}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

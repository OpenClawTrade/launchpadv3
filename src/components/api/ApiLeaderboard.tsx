import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Copy, ChevronLeft, ChevronRight, Users, TrendingUp, Coins } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  wallet_display: string;
  total_fees_earned: number;
  total_fees_paid_out: number;
  pending_fees: number;
  tokens_launched: number;
  launchpads_count: number;
  member_since: string;
}

interface ApiLeaderboardProps {
  currentWallet?: string | null;
}

export function ApiLeaderboard({ currentWallet }: ApiLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const currentUserRef = useRef<HTMLTableRowElement>(null);
  const perPage = 10;

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    // Scroll to current user's row after data loads
    if (currentWallet && leaderboard.length > 0 && currentUserRef.current) {
      currentUserRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [leaderboard, currentWallet]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-leaderboard?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const data = await response.json();
      if (!data.error) {
        setLeaderboard(data.leaderboard || []);
        setTotalUsers(data.total_api_users || 0);
        setTotalVolume(data.total_platform_volume || 0);
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-gray-500 font-mono">{rank}</span>;
  };

  const getRankBgClass = (rank: number) => {
    if (rank === 1) return "bg-yellow-500/10 border-yellow-500/30";
    if (rank === 2) return "bg-gray-400/10 border-gray-400/30";
    if (rank === 3) return "bg-amber-600/10 border-amber-600/30";
    return "";
  };

  const currentUserRank = currentWallet
    ? leaderboard.find((e) => e.wallet_address === currentWallet)?.rank
    : null;

  const paginatedData = leaderboard.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(leaderboard.length / perPage);

  if (loading) {
    return (
      <Card className="bg-[#12121a] border-[#1a1a1f]">
        <CardContent className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-transparent border-t-purple-500 rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#12121a] border-[#1a1a1f]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total API Developers</p>
                <p className="text-2xl font-bold text-white">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#12121a] border-[#1a1a1f]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Coins className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Volume</p>
                <p className="text-2xl font-bold text-white">{totalVolume.toFixed(2)} SOL</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {currentUserRank && (
          <Card className="bg-[#12121a] border-[#1a1a1f] border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Your Rank</p>
                  <p className="text-2xl font-bold text-purple-400">#{currentUserRank}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leaderboard Table */}
      <Card className="bg-[#12121a] border-[#1a1a1f]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            API Developer Leaderboard
          </CardTitle>
          <CardDescription>Ranked by lifetime fees earned</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No API developers yet</p>
              <p className="text-sm mt-2">Be the first to join!</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1a1a1f] hover:bg-transparent">
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead className="text-right">Fees Earned</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Tokens</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Launchpads</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Member Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((entry) => {
                    const isCurrentUser = currentWallet === entry.wallet_address;
                    return (
                      <TableRow
                        key={entry.wallet_address}
                        ref={isCurrentUser ? currentUserRef : null}
                        className={cn(
                          "border-[#1a1a1f] transition-colors",
                          getRankBgClass(entry.rank),
                          isCurrentUser && "ring-1 ring-purple-500/50 bg-purple-500/5"
                        )}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center justify-center w-8 h-8">
                            {getRankIcon(entry.rank)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-gray-300 font-mono">
                              {entry.wallet_display}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-500 hover:text-white"
                              onClick={() => copyAddress(entry.wallet_address)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            {isCurrentUser && (
                              <Badge className="bg-purple-600 text-white text-xs">You</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-500 font-semibold">
                            {entry.total_fees_earned.toFixed(4)} SOL
                          </span>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <Badge variant="secondary" className="bg-[#1a1a1f]">
                            {entry.tokens_launched}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          <Badge variant="secondary" className="bg-[#1a1a1f]">
                            {entry.launchpads_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-gray-500 hidden lg:table-cell">
                          {new Date(entry.member_since).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1a1a1f]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="border-[#2a2a3f] text-gray-300"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-400">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="border-[#2a2a3f] text-gray-300"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function getVoterFingerprint(): string {
  const key = "punch_voter_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export interface VoteCounts {
  likes: number;
  dislikes: number;
  userVote: 1 | -1 | null;
}

export function usePunchVotes(tokenIds: string[]) {
  const [votes, setVotes] = useState<Record<string, VoteCounts>>({});
  const fingerprint = getVoterFingerprint();

  const fetchVotes = useCallback(async () => {
    if (tokenIds.length === 0) return;

    const { data } = await supabase
      .from("punch_votes")
      .select("fun_token_id, vote_type, voter_fingerprint")
      .in("fun_token_id", tokenIds);

    if (!data) return;

    const map: Record<string, VoteCounts> = {};
    for (const id of tokenIds) {
      map[id] = { likes: 0, dislikes: 0, userVote: null };
    }
    for (const row of data) {
      const entry = map[row.fun_token_id];
      if (!entry) continue;
      if (row.vote_type === 1) entry.likes++;
      else entry.dislikes++;
      if (row.voter_fingerprint === fingerprint) {
        entry.userVote = row.vote_type as 1 | -1;
      }
    }
    setVotes(map);
  }, [tokenIds.join(","), fingerprint]);

  useEffect(() => {
    fetchVotes();

    const channel = supabase
      .channel("punch-votes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "punch_votes" },
        () => fetchVotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVotes]);

  const vote = useCallback(
    async (tokenId: string, voteType: 1 | -1) => {
      const current = votes[tokenId]?.userVote;

      // Optimistic update
      setVotes((prev) => {
        const entry = prev[tokenId] || { likes: 0, dislikes: 0, userVote: null };
        const updated = { ...entry };
        // Remove old vote
        if (current === 1) updated.likes--;
        if (current === -1) updated.dislikes--;
        // If same vote, just remove (toggle off)
        if (current === voteType) {
          updated.userVote = null;
        } else {
          if (voteType === 1) updated.likes++;
          else updated.dislikes++;
          updated.userVote = voteType;
        }
        return { ...prev, [tokenId]: updated };
      });

      if (current === voteType) {
        // Delete the vote (toggle off)
        await supabase
          .from("punch_votes")
          .delete()
          .eq("fun_token_id", tokenId)
          .eq("voter_fingerprint", fingerprint);
      } else if (current) {
        // Update existing vote
        await supabase
          .from("punch_votes")
          .update({ vote_type: voteType })
          .eq("fun_token_id", tokenId)
          .eq("voter_fingerprint", fingerprint);
      } else {
        // Insert new vote
        await supabase.from("punch_votes").insert({
          fun_token_id: tokenId,
          voter_fingerprint: fingerprint,
          vote_type: voteType,
        });
      }
    },
    [votes, fingerprint]
  );

  return { votes, vote };
}

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseSubTunaRealtimeOptions {
  subtunaId?: string;
  postId?: string;
  enabled?: boolean;
}

/**
 * Hook for realtime updates on SubTuna posts and comments.
 * Automatically invalidates queries when changes are detected.
 */
export function useSubTunaRealtime({
  subtunaId,
  postId,
  enabled = true,
}: UseSubTunaRealtimeOptions = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    // Channel for posts in a subtuna
    const channel = supabase.channel(`tunabook-realtime-${subtunaId || postId || "global"}`);

    // Subscribe to post changes
    if (subtunaId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subtuna_posts",
          filter: `subtuna_id=eq.${subtunaId}`,
        },
        (payload) => {
          console.log("[TunaBook Realtime] Post change:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
        }
      );
    } else {
      // Global feed - listen to all posts
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subtuna_posts",
        },
        (payload) => {
          console.log("[TunaBook Realtime] Global post change:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
        }
      );
    }

    // Subscribe to comment changes if viewing a specific post
    if (postId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subtuna_comments",
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log("[TunaBook Realtime] Comment change:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["subtuna-comments", postId] });
          queryClient.invalidateQueries({ queryKey: ["subtuna-post", postId] });
        }
      );
    }

    // Subscribe to vote changes for optimistic UI updates
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "subtuna_votes",
      },
      () => {
        // Debounce vote updates to avoid too many invalidations
        queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
      }
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[TunaBook Realtime] Connected");
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [subtunaId, postId, enabled, queryClient]);
}

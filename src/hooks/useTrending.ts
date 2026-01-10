import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrendingTopic {
  id: string;
  hashtag_id: string;
  name: string;
  category: string;
  score: number;
  post_count_1h: number;
  post_count_24h: number;
  velocity: number;
  rank: number;
}

export function useTrending(limit: number = 5) {
  const [trends, setTrends] = useState<TrendingTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = async () => {
    try {
      setIsLoading(true);
      
      // First try to get from trending_topics table
      const { data: trendingData, error: trendingError } = await supabase
        .from("trending_topics")
        .select(`
          id,
          hashtag_id,
          category,
          score,
          post_count_1h,
          post_count_24h,
          velocity,
          rank,
          hashtags!inner (
            name
          )
        `)
        .order("rank", { ascending: true })
        .limit(limit);

      if (trendingError) throw trendingError;

      if (trendingData && trendingData.length > 0) {
        const formattedTrends = trendingData.map((item: any) => ({
          id: item.id,
          hashtag_id: item.hashtag_id,
          name: item.hashtags?.name || "Unknown",
          category: item.category || "General",
          score: item.score,
          post_count_1h: item.post_count_1h,
          post_count_24h: item.post_count_24h,
          velocity: item.velocity,
          rank: item.rank,
        }));
        setTrends(formattedTrends);
      } else {
        // If no trending data, get most popular hashtags
        const { data: hashtagData, error: hashtagError } = await supabase
          .from("hashtags")
          .select("id, name, post_count")
          .order("post_count", { ascending: false })
          .limit(limit);

        if (hashtagError) throw hashtagError;

        const fallbackTrends = (hashtagData || []).map((h, index) => ({
          id: h.id,
          hashtag_id: h.id,
          name: h.name,
          category: "Trending",
          score: h.post_count,
          post_count_1h: 0,
          post_count_24h: h.post_count,
          velocity: 0,
          rank: index + 1,
        }));
        setTrends(fallbackTrends);
      }
    } catch (err: any) {
      console.error("Error fetching trending:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate trending topics
  const recalculateTrending = async () => {
    try {
      const { error } = await supabase.rpc("calculate_trending_topics");
      if (error) throw error;
      await fetchTrending();
    } catch (err: any) {
      console.error("Error recalculating trending:", err);
    }
  };

  useEffect(() => {
    // Defer to not block critical rendering path
    const timeoutId = setTimeout(() => {
      fetchTrending();
    }, 100);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return {
    trends,
    isLoading,
    error,
    refetch: fetchTrending,
    recalculate: recalculateTrending,
  };
}

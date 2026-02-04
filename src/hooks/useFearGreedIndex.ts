import { useQuery } from "@tanstack/react-query";

interface FearGreedData {
  value: number;
  value_classification: string;
  timestamp: string;
}

export function useFearGreedIndex() {
  return useQuery({
    queryKey: ["fear-greed-index"],
    queryFn: async (): Promise<FearGreedData> => {
      const response = await fetch("https://api.alternative.me/fng/?limit=1");
      if (!response.ok) {
        throw new Error("Failed to fetch Fear & Greed Index");
      }
      const data = await response.json();
      const item = data.data?.[0];
      return {
        value: parseInt(item.value, 10),
        value_classification: item.value_classification,
        timestamp: item.timestamp,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
}

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useOpenTunaAgents, OpenTunaAgent } from "@/hooks/useOpenTuna";
import { usePrivy } from "@privy-io/react-auth";

interface OpenTunaContextType {
  walletAddress: string | null;
  agents: OpenTunaAgent[];
  isLoadingAgents: boolean;
  selectedAgentId: string | null;
  selectedAgent: OpenTunaAgent | null;
  setSelectedAgentId: (id: string | null) => void;
  refetchAgents: () => void;
}

const OpenTunaContext = createContext<OpenTunaContextType | null>(null);

export function OpenTunaProvider({ children }: { children: ReactNode }) {
  const { authenticated, user } = usePrivy();
  
  // Get wallet address from Privy user object
  const walletAddress = user?.wallet?.address || null;
  
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  const { 
    data: agents = [], 
    isLoading: isLoadingAgents,
    refetch: refetchAgents,
  } = useOpenTunaAgents(walletAddress);
  
  // Auto-select first agent when agents load
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null;
  
  return (
    <OpenTunaContext.Provider
      value={{
        walletAddress,
        agents,
        isLoadingAgents,
        selectedAgentId,
        selectedAgent,
        setSelectedAgentId,
        refetchAgents,
      }}
    >
      {children}
    </OpenTunaContext.Provider>
  );
}

export function useOpenTunaContext() {
  const context = useContext(OpenTunaContext);
  if (!context) {
    throw new Error("useOpenTunaContext must be used within OpenTunaProvider");
  }
  return context;
}

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useClawAgents, ClawAgent } from "@/hooks/useClawSDK";
import { usePrivy } from "@privy-io/react-auth";

interface ClawSDKContextType {
  walletAddress: string | null;
  agents: ClawAgent[];
  isLoadingAgents: boolean;
  selectedAgentId: string | null;
  selectedAgent: ClawAgent | null;
  setSelectedAgentId: (id: string | null) => void;
  refetchAgents: () => void;
}

const ClawSDKContext = createContext<ClawSDKContextType | null>(null);

export function ClawSDKProvider({ children }: { children: ReactNode }) {
  const { authenticated, user } = usePrivy();
  
  // Get wallet address from Privy user object
  const walletAddress = user?.wallet?.address || null;
  
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  const { 
    data: agents = [], 
    isLoading: isLoadingAgents,
    refetch: refetchAgents,
  } = useClawAgents(walletAddress);
  
  // Auto-select first agent when agents load
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null;
  
  return (
    <ClawSDKContext.Provider
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
    </ClawSDKContext.Provider>
  );
}

export function useClawSDKContext() {
  const context = useContext(ClawSDKContext);
  if (!context) {
    throw new Error("useClawSDKContext must be used within ClawSDKProvider");
  }
  return context;
}

import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useChain, SupportedChain, CHAIN_CONFIGS } from '@/contexts/ChainContext';

/**
 * Hook to sync the chain context with the current route.
 * When visiting /launch/:chain, the chain context is updated.
 * When switching chains via the switcher, navigation happens automatically.
 */
export function useChainRoute() {
  const { chain, setChain, chainConfig } = useChain();
  const { chain: routeChain } = useParams<{ chain?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Sync chain context from route on mount/route change
  useEffect(() => {
    if (routeChain && routeChain in CHAIN_CONFIGS) {
      const newChain = routeChain as SupportedChain;
      if (newChain !== chain) {
        setChain(newChain);
      }
    }
  }, [routeChain, chain, setChain]);

  // Check if we're on a launch route
  const isLaunchRoute = location.pathname.startsWith('/launch');

  // Get the current chain from route if on launch route, otherwise from context
  const activeChain = isLaunchRoute && routeChain && routeChain in CHAIN_CONFIGS 
    ? routeChain as SupportedChain 
    : chain;

  return {
    chain: activeChain,
    chainConfig: CHAIN_CONFIGS[activeChain],
    isLaunchRoute,
    isSolana: activeChain === 'solana',
    isEvm: activeChain !== 'solana',
    isChainEnabled: CHAIN_CONFIGS[activeChain].isEnabled,
  };
}

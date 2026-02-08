import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeploymentResult {
  success: boolean;
  network: string;
  deployer?: string;
  contracts?: {
    TunaFactory: string;
    TunaToken: string;
  };
  txHashes?: string[];
  error?: string;
}

interface DryRunResult {
  dryRun: true;
  deployer: string;
  balance: string;
  network: string;
  chain: string;
  message: string;
  willDeploy: string[];
}

export function useBaseContractDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeploymentResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkDeployment = useCallback(async (network: 'mainnet' | 'sepolia' = 'sepolia') => {
    setError(null);
    setDryRunResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('base-deploy-contracts', {
        body: { network, dryRun: true },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Dry run failed');
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setDryRunResult(response.data as DryRunResult);
      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check failed';
      setError(message);
      throw err;
    }
  }, []);

  const deployContracts = useCallback(async (network: 'mainnet' | 'sepolia' = 'sepolia') => {
    setIsDeploying(true);
    setError(null);
    setDeployResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('base-deploy-contracts', {
        body: { network, dryRun: false },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Deployment failed');
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const result = response.data as DeploymentResult;
      setDeployResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed';
      setError(message);
      throw err;
    } finally {
      setIsDeploying(false);
    }
  }, []);

  const getLatestDeployment = useCallback(async (network: 'mainnet' | 'sepolia' = 'sepolia') => {
    const { data, error } = await supabase
      .from('base_deployments')
      .select('*')
      .eq('network', network)
      .eq('is_active', true)
      .order('deployed_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch deployment:', error);
      return null;
    }

    return data;
  }, []);

  return {
    // State
    isDeploying,
    deployResult,
    dryRunResult,
    error,
    
    // Actions
    checkDeployment,
    deployContracts,
    getLatestDeployment,
  };
}

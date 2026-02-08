import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBaseContractDeploy } from '@/hooks/useBaseContractDeploy';
import { Rocket, CheckCircle2, AlertCircle, Loader2, ExternalLink, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export function BaseDeployPanel() {
  const { 
    isDeploying, 
    deployResult, 
    dryRunResult, 
    error, 
    checkDeployment, 
    deployContracts,
    getLatestDeployment 
  } = useBaseContractDeploy();
  
  const [network, setNetwork] = useState<'mainnet' | 'sepolia'>('mainnet');
  const [isChecking, setIsChecking] = useState(false);
  const [existingDeployment, setExistingDeployment] = useState<any>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const handleCheckDeployment = async () => {
    setIsChecking(true);
    try {
      await checkDeployment(network);
      toast.success('Dry run complete - ready to deploy');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setIsChecking(false);
    }
  };

  const handleDeploy = async () => {
    try {
      const result = await deployContracts(network);
      if (result.success) {
        toast.success(`Contracts deployed to ${network}!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deployment failed');
    }
  };

  const handleLoadExisting = async () => {
    setLoadingExisting(true);
    try {
      const deployment = await getLatestDeployment(network);
      setExistingDeployment(deployment);
      if (!deployment) {
        toast.info('No existing deployment found for this network');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExisting(false);
    }
  };

  const explorerUrl = network === 'mainnet' 
    ? 'https://basescan.org' 
    : 'https://sepolia.basescan.org';

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Base Contract Deployment
            </CardTitle>
            <CardDescription>
              Deploy TunaFactory and TunaToken contracts to Base
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={network === 'sepolia' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setNetwork('sepolia')}
            >
              Sepolia
            </Button>
            <Button
              variant={network === 'mainnet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setNetwork('mainnet')}
            >
              Mainnet
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleLoadExisting} 
            variant="outline"
            disabled={loadingExisting}
          >
            {loadingExisting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4 mr-2" />
            )}
            Load Existing
          </Button>
          
          <Button 
            onClick={handleCheckDeployment} 
            variant="secondary"
            disabled={isChecking || isDeploying}
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Dry Run
          </Button>
          
          <Button 
            onClick={handleDeploy} 
            disabled={isDeploying || isChecking}
            className="bg-primary hover:bg-primary/90"
          >
            {isDeploying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            Deploy to {network === 'mainnet' ? 'Base' : 'Sepolia'}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Dry Run Result */}
        {dryRunResult && (
          <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">Dry Run Success</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Network:</span>
                <span className="ml-2">{dryRunResult.network}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Balance:</span>
                <span className="ml-2">{dryRunResult.balance}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Deployer:</span>
                <code className="ml-2 text-xs bg-background px-1 py-0.5 rounded">
                  {dryRunResult.deployer}
                </code>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Will Deploy:</span>
                <div className="flex gap-1 mt-1">
                  {dryRunResult.willDeploy.map((c) => (
                    <Badge key={c} variant="secondary">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deploy Result */}
        {deployResult?.success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-bold text-green-500">Deployment Successful!</span>
            </div>
            
            {deployResult.contracts && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">TunaFactory:</span>
                  <a 
                    href={`${explorerUrl}/address/${deployResult.contracts.TunaFactory}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <code className="text-xs">{deployResult.contracts.TunaFactory}</code>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">TunaToken:</span>
                  <a 
                    href={`${explorerUrl}/address/${deployResult.contracts.TunaToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <code className="text-xs">{deployResult.contracts.TunaToken}</code>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {deployResult.txHashes && deployResult.txHashes.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Transactions:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {deployResult.txHashes.map((hash, i) => (
                    <a
                      key={hash}
                      href={`${explorerUrl}/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      TX {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing Deployment */}
        {existingDeployment && (
          <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="font-medium">Existing Deployment ({existingDeployment.network})</span>
            </div>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Deployed:</span>
                <span className="ml-2">{new Date(existingDeployment.deployed_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Deployer:</span>
                <code className="ml-2 text-xs bg-background px-1 py-0.5 rounded">
                  {existingDeployment.deployer}
                </code>
              </div>
              {existingDeployment.contracts && (
                <>
                  <div>
                    <span className="text-muted-foreground">Factory:</span>
                    <a 
                      href={`${explorerUrl}/address/${existingDeployment.contracts.TunaFactory}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-primary hover:underline text-xs"
                    >
                      {existingDeployment.contracts.TunaFactory}
                    </a>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Token:</span>
                    <a 
                      href={`${explorerUrl}/address/${existingDeployment.contracts.TunaToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-primary hover:underline text-xs"
                    >
                      {existingDeployment.contracts.TunaToken}
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

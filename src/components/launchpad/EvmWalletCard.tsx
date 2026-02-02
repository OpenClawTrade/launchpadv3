import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ExternalLink, AlertCircle } from 'lucide-react';
import { useEvmWallet } from '@/hooks/useEvmWallet';

export function EvmWalletCard() {
  const { 
    address, 
    shortAddress, 
    isConnected, 
    balance, 
    isOnBase, 
    switchToBase,
    isBalanceLoading 
  } = useEvmWallet();

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Base Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <Button 
            disabled
            className="w-full bg-muted text-muted-foreground cursor-not-allowed"
          >
            <Wallet className="mr-2 h-4 w-4" />
            Base Launchpad Goes Live Soon
          </Button>
        ) : (
          <>
            {/* Connected Address */}
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-mono">{shortAddress}</span>
              </div>
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {/* Chain Warning */}
            {!isOnBase && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">Wrong network</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={switchToBase}
                  className="ml-auto"
                >
                  Switch to Base
                </Button>
              </div>
            )}

            {/* Balance */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ETH Balance</span>
                <span className="font-mono font-medium">
                  {isBalanceLoading ? '...' : `${balance} ETH`}
                </span>
              </div>
            </div>

            {/* RainbowKit Account Button for disconnect/switch */}
            <ConnectButton.Custom>
              {({ openAccountModal }) => (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={openAccountModal}
                  className="w-full"
                >
                  Manage Wallet
                </Button>
              )}
            </ConnectButton.Custom>
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ExternalLink, AlertCircle, Copy, Check, LogOut } from 'lucide-react';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { useChain } from '@/contexts/ChainContext';
import { useState } from 'react';
import { toast } from 'sonner';

const BNB_LOGO = "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png";

export function EvmWalletCard() {
  const { 
    address, 
    shortAddress, 
    isConnected, 
    balance, 
    isOnBase,
    isOnBnb, 
    switchToBase,
    switchToBnb,
    connect,
    disconnect,
    isBalanceLoading 
  } = useEvmWallet();
  
  const { chain } = useChain();
  const isBnb = chain === 'bnb';
  const [copied, setCopied] = useState(false);

  const isOnCorrectChain = isBnb ? isOnBnb : isOnBase;
  const chainLabel = isBnb ? 'BNB Chain' : 'Base';
  const nativeToken = isBnb ? 'BNB' : 'ETH';
  const explorerBase = isBnb ? 'https://bscscan.com/address/' : 'https://basescan.org/address/';
  const switchFn = isBnb ? switchToBnb : switchToBase;

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {isBnb ? (
            <img src={BNB_LOGO} alt="BNB" className="h-5 w-5 rounded-full" />
          ) : (
            <Wallet className="h-5 w-5 text-blue-400" />
          )}
          {chainLabel} Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your wallet to launch tokens on {chainLabel}
            </p>
            <Button 
              onClick={connect}
              className={`w-full ${isBnb ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          </div>
        ) : (
          <>
            {/* Connected Address */}
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-mono">{shortAddress}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
                <a
                  href={`${explorerBase}${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors p-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Chain Warning */}
            {!isOnCorrectChain && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">Wrong network</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={switchFn}
                  className="ml-auto text-xs"
                >
                  Switch to {chainLabel}
                </Button>
              </div>
            )}

            {/* Balance */}
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                <span className="text-sm text-muted-foreground">{nativeToken} Balance</span>
                <span className="font-mono font-medium">
                  {isBalanceLoading ? (
                    <span className="text-muted-foreground">...</span>
                  ) : (
                    <span className={isBnb ? 'text-yellow-400' : 'text-blue-400'}>{balance} {nativeToken}</span>
                  )}
                </span>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => disconnect()}
              className="w-full"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Disconnect Wallet
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

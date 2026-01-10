import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Token, formatSolAmount } from "@/hooks/useLaunchpad";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, Shield, TrendingDown, Repeat, AlertTriangle } from "lucide-react";

interface AdvancedOrderFormProps {
  token: Token;
  userBalance?: number;
  onOrderCreated?: () => void;
}

type OrderType = 'limit' | 'stop_loss' | 'take_profit' | 'dca';

export function AdvancedOrderForm({ token, userBalance = 0, onOrderCreated }: AdvancedOrderFormProps) {
  const { isAuthenticated, login, solanaAddress, profileId } = useAuth();
  const { toast } = useToast();
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // DCA specific
  const [dcaOrders, setDcaOrders] = useState('10');
  const [dcaInterval, setDcaInterval] = useState('3600'); // 1 hour in seconds

  const currentPrice = token.price_sol || 0;

  const handleCreateOrder = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }

    if (!solanaAddress) {
      toast({ title: "Please connect your wallet", variant: "destructive" });
      return;
    }

    const numAmount = parseFloat(amount);
    const numTriggerPrice = parseFloat(triggerPrice);

    if (!numAmount || numAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    if (orderType !== 'dca' && (!numTriggerPrice || numTriggerPrice <= 0)) {
      toast({ title: "Invalid trigger price", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      if (orderType === 'dca') {
        // Create DCA order
        const { error } = await supabase.from('dca_orders').insert({
          token_id: token.id,
          user_wallet: solanaAddress,
          profile_id: profileId || null,
          side,
          amount_per_order: numAmount,
          total_orders: parseInt(dcaOrders),
          interval_seconds: parseInt(dcaInterval),
          next_execution_at: new Date(Date.now() + parseInt(dcaInterval) * 1000).toISOString(),
          status: 'active',
        });

        if (error) throw error;

        toast({
          title: "DCA Order Created!",
          description: `${parseInt(dcaOrders)} orders of ${numAmount} SOL each`,
        });
      } else {
        // Create limit/stop-loss/take-profit order
        const { error } = await supabase.from('limit_orders').insert({
          token_id: token.id,
          user_wallet: solanaAddress,
          profile_id: profileId || null,
          order_type: orderType,
          side,
          trigger_price: numTriggerPrice,
          amount: numAmount,
          amount_type: side === 'buy' ? 'sol' : 'token',
          status: 'pending',
        });

        if (error) throw error;

        toast({
          title: "Order Created!",
          description: `${orderType.replace('_', ' ')} ${side} at ${formatSolAmount(numTriggerPrice)} SOL`,
        });
      }

      // Reset form
      setAmount('');
      setTriggerPrice('');
      onOrderCreated?.();
    } catch (error) {
      console.error('Create order error:', error);
      toast({
        title: "Failed to create order",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getOrderTypeIcon = (type: OrderType) => {
    switch (type) {
      case 'limit': return <Target className="h-4 w-4" />;
      case 'stop_loss': return <Shield className="h-4 w-4" />;
      case 'take_profit': return <TrendingDown className="h-4 w-4" />;
      case 'dca': return <Repeat className="h-4 w-4" />;
    }
  };

  const isGraduated = token.status === 'graduated';

  if (isGraduated) {
    return null;
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Advanced Orders</h3>
        <span className="text-xs text-muted-foreground">
          Current: {formatSolAmount(currentPrice)} SOL
        </span>
      </div>

      {/* Order Type Tabs */}
      <Tabs value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="limit" className="flex-col py-2 px-1 text-xs gap-1">
            {getOrderTypeIcon('limit')}
            <span>Limit</span>
          </TabsTrigger>
          <TabsTrigger value="stop_loss" className="flex-col py-2 px-1 text-xs gap-1">
            {getOrderTypeIcon('stop_loss')}
            <span>Stop</span>
          </TabsTrigger>
          <TabsTrigger value="take_profit" className="flex-col py-2 px-1 text-xs gap-1">
            {getOrderTypeIcon('take_profit')}
            <span>TP</span>
          </TabsTrigger>
          <TabsTrigger value="dca" className="flex-col py-2 px-1 text-xs gap-1">
            {getOrderTypeIcon('dca')}
            <span>DCA</span>
          </TabsTrigger>
        </TabsList>

        {/* Buy/Sell Toggle */}
        <div className="flex gap-1 mt-4 p-1 bg-secondary rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 h-8 ${side === 'buy' ? 'bg-green-500/20 text-green-500' : ''}`}
            onClick={() => setSide('buy')}
          >
            Buy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 h-8 ${side === 'sell' ? 'bg-red-500/20 text-red-500' : ''}`}
            onClick={() => setSide('sell')}
          >
            Sell
          </Button>
        </div>

        {/* Order Form */}
        <div className="space-y-4 mt-4">
          {orderType !== 'dca' && (
            <div className="space-y-2">
              <Label className="text-xs">Trigger Price (SOL)</Label>
              <Input
                type="number"
                placeholder={formatSolAmount(currentPrice)}
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                step="0.000001"
              />
              {triggerPrice && (
                <p className="text-xs text-muted-foreground">
                  {((parseFloat(triggerPrice) - currentPrice) / currentPrice * 100).toFixed(2)}% from current
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">
              {orderType === 'dca' ? 'Amount per Order (SOL)' : side === 'buy' ? 'Amount (SOL)' : `Amount (${token.ticker})`}
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {orderType === 'dca' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Number of Orders</Label>
                  <Select value={dcaOrders} onValueChange={setDcaOrders}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 orders</SelectItem>
                      <SelectItem value="10">10 orders</SelectItem>
                      <SelectItem value="20">20 orders</SelectItem>
                      <SelectItem value="50">50 orders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Interval</Label>
                  <Select value={dcaInterval} onValueChange={setDcaInterval}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="300">5 min</SelectItem>
                      <SelectItem value="900">15 min</SelectItem>
                      <SelectItem value="3600">1 hour</SelectItem>
                      <SelectItem value="86400">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg text-xs text-muted-foreground">
                Total: {(parseFloat(amount || '0') * parseInt(dcaOrders)).toFixed(4)} SOL over{' '}
                {parseInt(dcaOrders) * parseInt(dcaInterval) / 3600} hours
              </div>
            </>
          )}

          {/* Warning for stop-loss */}
          {orderType === 'stop_loss' && side === 'sell' && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Stop-loss will sell your tokens when price drops to trigger price</span>
            </div>
          )}

          <Button
            className={`w-full ${side === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            onClick={handleCreateOrder}
            disabled={isLoading || !amount}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Create ${orderType.replace('_', ' ')} Order`
            )}
          </Button>
        </div>
      </Tabs>
    </Card>
  );
}
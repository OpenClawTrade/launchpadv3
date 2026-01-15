import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Token, formatSolAmount } from "@/hooks/useLaunchpad";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, Shield, TrendingDown, Repeat, AlertTriangle, Lock } from "lucide-react";

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
    <Card className="relative p-4 space-y-4 overflow-hidden">
      {/* Blur overlay with "Available Soon" */}
      <div className="absolute inset-0 z-10 backdrop-blur-sm bg-background/60 flex flex-col items-center justify-center">
        <div className="flex items-center gap-2 bg-primary/20 text-primary px-4 py-2 rounded-full border border-primary/30">
          <Lock className="h-4 w-4" />
          <span className="font-semibold text-sm">Available Soon</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center px-4">
          Advanced trading features coming soon
        </p>
      </div>

      {/* Original content (blurred) */}
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
                disabled
              />
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
              disabled
            />
          </div>

          {orderType === 'dca' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Number of Orders</Label>
                  <Select value={dcaOrders} onValueChange={setDcaOrders} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 orders</SelectItem>
                      <SelectItem value="10">10 orders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Interval</Label>
                  <Select value={dcaInterval} onValueChange={setDcaInterval} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3600">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <Button
            className={`w-full ${side === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            disabled
          >
            Create Order
          </Button>
        </div>
      </Tabs>
    </Card>
  );
}

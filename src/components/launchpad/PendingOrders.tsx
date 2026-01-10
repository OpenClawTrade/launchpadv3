import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatSolAmount, formatTokenAmount } from "@/hooks/useLaunchpad";
import { X, Target, Shield, TrendingDown, Repeat, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface PendingOrdersProps {
  tokenId?: string;
  showAll?: boolean;
}

export function PendingOrders({ tokenId, showAll = false }: PendingOrdersProps) {
  const { solanaAddress } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Fetch limit orders
  const { data: limitOrders = [], isLoading: loadingLimitOrders } = useQuery({
    queryKey: ['pending-limit-orders', solanaAddress, tokenId],
    queryFn: async () => {
      if (!solanaAddress) return [];
      
      let query = supabase
        .from('limit_orders')
        .select(`
          *,
          tokens (
            id,
            name,
            ticker,
            image_url,
            mint_address,
            price_sol
          )
        `)
        .eq('user_wallet', solanaAddress)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (tokenId) {
        query = query.eq('token_id', tokenId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!solanaAddress,
  });

  // Fetch DCA orders
  const { data: dcaOrders = [], isLoading: loadingDcaOrders } = useQuery({
    queryKey: ['pending-dca-orders', solanaAddress, tokenId],
    queryFn: async () => {
      if (!solanaAddress) return [];
      
      let query = supabase
        .from('dca_orders')
        .select(`
          *,
          tokens (
            id,
            name,
            ticker,
            image_url,
            mint_address
          )
        `)
        .eq('user_wallet', solanaAddress)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false });

      if (tokenId) {
        query = query.eq('token_id', tokenId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!solanaAddress,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!solanaAddress) return;

    const limitChannel = supabase
      .channel('limit-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'limit_orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-limit-orders'] });
        }
      )
      .subscribe();

    const dcaChannel = supabase
      .channel('dca-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dca_orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-dca-orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(limitChannel);
      supabase.removeChannel(dcaChannel);
    };
  }, [solanaAddress, queryClient]);

  const cancelLimitOrder = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      const { error } = await supabase
        .from('limit_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw error;

      toast({ title: "Order cancelled" });
      queryClient.invalidateQueries({ queryKey: ['pending-limit-orders'] });
    } catch (error) {
      toast({ title: "Failed to cancel order", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  const cancelDcaOrder = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      const { error } = await supabase
        .from('dca_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw error;

      toast({ title: "DCA order cancelled" });
      queryClient.invalidateQueries({ queryKey: ['pending-dca-orders'] });
    } catch (error) {
      toast({ title: "Failed to cancel order", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'limit': return <Target className="h-3.5 w-3.5" />;
      case 'stop_loss': return <Shield className="h-3.5 w-3.5" />;
      case 'take_profit': return <TrendingDown className="h-3.5 w-3.5" />;
      default: return <Repeat className="h-3.5 w-3.5" />;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'limit': return 'Limit';
      case 'stop_loss': return 'Stop Loss';
      case 'take_profit': return 'Take Profit';
      default: return type;
    }
  };

  const isLoading = loadingLimitOrders || loadingDcaOrders;
  const hasOrders = limitOrders.length > 0 || dcaOrders.length > 0;

  if (!solanaAddress) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (!hasOrders) {
    return null;
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Pending Orders</h3>

      {/* Limit Orders */}
      {limitOrders.map((order: any) => (
        <div 
          key={order.id} 
          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded ${order.side === 'buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {getOrderTypeIcon(order.order_type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {getOrderTypeLabel(order.order_type)} {order.side.toUpperCase()}
                </span>
                {showAll && order.tokens && (
                  <Badge variant="outline" className="text-xs">
                    ${order.tokens.ticker}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                @ {formatSolAmount(order.trigger_price)} SOL • {order.amount} {order.amount_type}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => cancelLimitOrder(order.id)}
            disabled={cancellingId === order.id}
          >
            {cancellingId === order.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      ))}

      {/* DCA Orders */}
      {dcaOrders.map((order: any) => (
        <div 
          key={order.id} 
          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded ${order.side === 'buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              <Repeat className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  DCA {order.side.toUpperCase()}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {order.orders_executed}/{order.total_orders}
                </Badge>
                {showAll && order.tokens && (
                  <Badge variant="outline" className="text-xs">
                    ${order.tokens.ticker}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {order.amount_per_order} SOL every {order.interval_seconds / 60}min
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => cancelDcaOrder(order.id)}
            disabled={cancellingId === order.id}
          >
            {cancellingId === order.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      ))}
    </Card>
  );
}
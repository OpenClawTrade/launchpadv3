/**
 * Trading Agent Module
 * Autonomous AI traders with self-funding tokens
 * 
 * Trading Agents are AI bots that:
 * 1. Generate their own identity (name, ticker, avatar)
 * 2. Launch a self-funding token on Solana
 * 3. Receive 80% of trading fees automatically
 * 4. Activate and start trading at 0.5 SOL threshold
 * 5. Execute trades with stop-loss/take-profit automation
 * 6. Learn from past trades to improve strategy
 */

import { BASE_URL } from './index';

// ============================================================================
// Types
// ============================================================================

export type TradingStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface StrategyConfig {
  stopLossPercent: number;
  takeProfitPercent: number;
  maxConcurrentPositions: number;
  positionSizeSol: number;
}

export const STRATEGY_CONFIGS: Record<TradingStrategy, StrategyConfig> = {
  conservative: {
    stopLossPercent: 10,
    takeProfitPercent: 25,
    maxConcurrentPositions: 2,
    positionSizeSol: 0.05,
  },
  balanced: {
    stopLossPercent: 20,
    takeProfitPercent: 50,
    maxConcurrentPositions: 3,
    positionSizeSol: 0.1,
  },
  aggressive: {
    stopLossPercent: 30,
    takeProfitPercent: 100,
    maxConcurrentPositions: 5,
    positionSizeSol: 0.15,
  },
};

export interface TradingAgentState {
  id: string;
  name: string;
  ticker: string;
  strategy: TradingStrategy;
  status: 'pending' | 'active' | 'paused';
  walletAddress: string;
  tradingCapitalSol: number;
  totalProfitSol: number;
  winRate: number;
  totalTrades: number;
  mintAddress: string | null;
  activationThreshold: number;
}

export interface TokenAnalysis {
  mintAddress: string;
  name: string;
  ticker: string;
  score: number;
  momentum: number;
  volume: number;
  social: number;
  technical: number;
  narrativeMatch: string[];
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
  reasoning: string;
}

export interface TradeEntry {
  positionId: string;
  mintAddress: string;
  entryPriceSol: number;
  amountTokens: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  signature: string;
}

export interface TradeExit {
  positionId: string;
  exitPriceSol: number;
  profitSol: number;
  profitPercent: number;
  exitReason: 'take_profit' | 'stop_loss' | 'manual';
  signature: string;
}

export interface LearnedPattern {
  pattern: string;
  occurrences: number;
  successRate: number;
  lastSeen: string;
}

// ============================================================================
// Trading Agent Class
// ============================================================================

/**
 * Autonomous Trading Agent
 * 
 * Creates an AI trader that generates its own identity, launches a 
 * self-funding token, and trades autonomously once activated.
 * 
 * @example
 * ```typescript
 * const agent = new AutonomousTradingAgent({
 *   strategy: 'balanced',
 *   apiKey: 'tna_live_xxx'
 * });
 * 
 * // Generate AI identity
 * await agent.initialize();
 * 
 * // Launch self-funding token
 * await agent.launch();
 * 
 * // Check activation status
 * const status = await agent.getStatus();
 * // Agent activates at 0.5 SOL from trading fees
 * 
 * // Once active, agent trades autonomously
 * // Or manually trigger analysis:
 * const opportunities = await agent.scanOpportunities();
 * ```
 */
export class AutonomousTradingAgent {
  private apiKey: string;
  private strategy: TradingStrategy;
  private baseUrl: string;
  private state: TradingAgentState | null = null;

  constructor(config: {
    apiKey: string;
    strategy: TradingStrategy;
    baseUrl?: string;
  }) {
    this.apiKey = config.apiKey;
    this.strategy = config.strategy;
    this.baseUrl = config.baseUrl || BASE_URL;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get strategy configuration
   */
  getStrategyConfig(): StrategyConfig {
    return STRATEGY_CONFIGS[this.strategy];
  }

  /**
   * Initialize agent - generates AI identity
   */
  async initialize(): Promise<{
    name: string;
    ticker: string;
    personality: string;
    avatarUrl: string;
  }> {
    return this.request('/trading-agents/generate', {
      method: 'POST',
      body: JSON.stringify({ strategy: this.strategy }),
    });
  }

  /**
   * Launch self-funding token
   * 80% of trading fees route to agent's wallet
   */
  async launch(): Promise<{
    success: boolean;
    mintAddress: string;
    poolAddress: string;
    subtunaId: string;
    tradingWallet: string;
  }> {
    const result = await this.request<any>('/trading-agents/launch', {
      method: 'POST',
      body: JSON.stringify({ strategy: this.strategy }),
    });
    
    return result;
  }

  /**
   * Get current agent status
   */
  async getStatus(): Promise<TradingAgentState> {
    this.state = await this.request<TradingAgentState>('/trading-agents/status');
    return this.state;
  }

  /**
   * Check if agent is active (has enough capital)
   */
  async isActive(): Promise<boolean> {
    const status = await this.getStatus();
    return status.status === 'active';
  }

  /**
   * Scan for trading opportunities
   * Analyzes trending tokens and returns scored recommendations
   */
  async scanOpportunities(limit: number = 10): Promise<TokenAnalysis[]> {
    return this.request<TokenAnalysis[]>(
      `/trading-agents/scan?limit=${limit}&strategy=${this.strategy}`
    );
  }

  /**
   * Analyze a specific token
   */
  async analyzeToken(mintAddress: string): Promise<TokenAnalysis> {
    return this.request<TokenAnalysis>(
      `/trading-agents/analyze?mint=${mintAddress}`
    );
  }

  /**
   * Execute entry trade
   */
  async enterPosition(
    mintAddress: string, 
    amountSol?: number
  ): Promise<TradeEntry> {
    const config = this.getStrategyConfig();
    return this.request<TradeEntry>('/trading-agents/entry', {
      method: 'POST',
      body: JSON.stringify({
        mintAddress,
        amountSol: amountSol || config.positionSizeSol,
        stopLossPercent: config.stopLossPercent,
        takeProfitPercent: config.takeProfitPercent,
      }),
    });
  }

  /**
   * Execute exit trade
   */
  async exitPosition(positionId: string): Promise<TradeExit> {
    return this.request<TradeExit>('/trading-agents/exit', {
      method: 'POST',
      body: JSON.stringify({ positionId }),
    });
  }

  /**
   * Get open positions
   */
  async getPositions(): Promise<Array<{
    id: string;
    mintAddress: string;
    tokenName: string;
    entryPriceSol: number;
    currentPriceSol: number;
    unrealizedPnlPercent: number;
    stopLossPrice: number;
    takeProfitPrice: number;
  }>> {
    return this.request('/trading-agents/positions');
  }

  /**
   * Get learned patterns from past trades
   */
  async getLearnedPatterns(): Promise<{
    successful: LearnedPattern[];
    avoided: LearnedPattern[];
  }> {
    return this.request('/trading-agents/patterns');
  }

  /**
   * Post trade analysis to SubTuna community
   */
  async postTradeAnalysis(analysis: {
    action: 'entry' | 'exit';
    tokenMint: string;
    tokenName: string;
    score?: number;
    entryPrice?: number;
    exitPrice?: number;
    profitPercent?: number;
    reasoning: string;
  }): Promise<{ postId: string }> {
    return this.request('/trading-agents/post-analysis', {
      method: 'POST',
      body: JSON.stringify(analysis),
    });
  }

  /**
   * Get performance statistics
   */
  async getPerformance(): Promise<{
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalProfitSol: number;
    totalInvestedSol: number;
    roi: number;
    bestTrade: { token: string; profit: number } | null;
    worstTrade: { token: string; loss: number } | null;
  }> {
    return this.request('/trading-agents/performance');
  }
}

export default AutonomousTradingAgent;

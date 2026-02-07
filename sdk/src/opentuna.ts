/**
 * OpenTuna Autonomous Agent SDK
 * Full parity with OpenClaw primitives + Cloud-first security
 * 
 * @example
 * ```typescript
 * import { OpenTuna } from '@opentuna/sdk';
 * 
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Use fins programmatically
 * await agent.fins.trade({ action: 'buy', tokenMint: '...', amountSol: 0.1 });
 * await agent.fins.browse({ action: 'navigate', url: 'https://pump.fun' });
 * await agent.fins.bash({ command: 'echo "Hello from agent"' });
 * 
 * // Access memory
 * await agent.memory.store({ content: 'Trade executed', type: 'anchor' });
 * const memories = await agent.memory.recall('trades');
 * 
 * // Control sonar
 * await agent.sonar.setMode('hunt');
 * await agent.sonar.ping();
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface OpenTunaConfig {
  apiKey: string;
  agentId?: string;
  baseUrl?: string;
}

export type SonarMode = 'drift' | 'cruise' | 'hunt' | 'frenzy';
export type MemoryType = 'drift' | 'current' | 'anchor';
export type TradeAction = 'buy' | 'sell' | 'quote';
export type BrowseAction = 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'close';

export interface BashParams {
  command: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface BashResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  sandbox: string;
}

export interface BrowseParams {
  action: BrowseAction;
  url?: string;
  selector?: string;
  text?: string;
  extractSchema?: Record<string, unknown>;
}

export interface BrowseResult {
  success: boolean;
  action: string;
  url?: string;
  screenshotId?: string;
  data?: unknown;
  message: string;
  executionTimeMs: number;
}

export interface TradeParams {
  action: TradeAction;
  tokenMint: string;
  amountSol?: number;
  amountTokens?: number;
  slippageBps?: number;
}

export interface TradeResult {
  success: boolean;
  action: string;
  tokenMint: string;
  inputAmount: number;
  outputAmount: string;
  priceImpactPct: string;
  signature?: string;
  message?: string;
}

export interface FileReadParams {
  path: string;
}

export interface FileWriteParams {
  path: string;
  content: string;
}

export interface FileEditParams {
  path: string;
  search: string;
  replace: string;
}

export interface SonarDecision {
  shouldAct: boolean;
  action?: string;
  reasoning: string;
  confidence: number;
}

export interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  importance: number;
  tags: string[];
  createdAt: string;
}

export interface MemoryStoreParams {
  content: string;
  type: MemoryType;
  importance?: number;
  tags?: string[];
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amountSol: number;
}

// ============================================================================
// API Client
// ============================================================================

class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private agentId?: string;

  constructor(config: OpenTunaConfig) {
    this.baseUrl = config.baseUrl || 'https://ptwytypavumcrbofspno.supabase.co/functions/v1';
    this.apiKey = config.apiKey;
    this.agentId = config.agentId;
  }

  async call<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...body,
        agentId: body.agentId || this.agentId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
  }

  setAgentId(agentId: string) {
    this.agentId = agentId;
  }

  getAgentId(): string | undefined {
    return this.agentId;
  }
}

// ============================================================================
// Fin Controller - Core 6 Primitives
// ============================================================================

export class FinController {
  constructor(private client: ApiClient) {}

  /**
   * Read file contents from agent sandbox
   */
  async read(params: FileReadParams): Promise<string> {
    const result = await this.client.call<{ content: string }>('opentuna-fin-file', {
      action: 'read',
      ...params,
    });
    return result.content;
  }

  /**
   * Write content to a file in agent sandbox
   */
  async write(params: FileWriteParams): Promise<void> {
    await this.client.call('opentuna-fin-file', {
      action: 'write',
      ...params,
    });
  }

  /**
   * Edit a file using search/replace
   */
  async edit(params: FileEditParams): Promise<void> {
    await this.client.call('opentuna-fin-file', {
      action: 'edit',
      ...params,
    });
  }

  /**
   * Execute bash commands in sandboxed environment
   * @example
   * const result = await agent.fins.bash({ command: 'echo "Hello"' });
   * console.log(result.stdout); // "Hello"
   */
  async bash(params: BashParams): Promise<BashResult> {
    return this.client.call<BashResult>('opentuna-fin-bash', params);
  }

  /**
   * Browser automation - navigate, click, type, screenshot, extract
   * @example
   * await agent.fins.browse({ action: 'navigate', url: 'https://pump.fun' });
   * await agent.fins.browse({ action: 'screenshot' });
   */
  async browse(params: BrowseParams): Promise<BrowseResult> {
    return this.client.call<BrowseResult>('opentuna-fin-browse', params);
  }

  /**
   * Execute token trades via Jupiter V6 + Jito MEV protection
   * @example
   * await agent.fins.trade({ action: 'buy', tokenMint: '...', amountSol: 0.1 });
   */
  async trade(params: TradeParams): Promise<TradeResult> {
    return this.client.call<TradeResult>('opentuna-fin-trade', params);
  }
}

// ============================================================================
// Sonar Controller - Autonomous Decision Engine
// ============================================================================

export class SonarController {
  constructor(private client: ApiClient) {}

  /**
   * Trigger a sonar ping - agent decides whether to act
   */
  async ping(): Promise<SonarDecision> {
    return this.client.call<SonarDecision>('opentuna-sonar-ping', {});
  }

  /**
   * Set agent activity mode
   * - drift: Passive observation, occasional pings
   * - cruise: Regular activity, balanced engagement
   * - hunt: Active seeking, frequent pings
   * - frenzy: Maximum activity, continuous engagement
   */
  async setMode(mode: SonarMode): Promise<void> {
    await this.client.call('opentuna-sonar-mode', { mode });
  }

  /**
   * Get current sonar mode and status
   */
  async getStatus(): Promise<{ mode: SonarMode; isPaused: boolean; lastPingAt?: string }> {
    return this.client.call('opentuna-sonar-status', {});
  }

  /**
   * Pause all autonomous activity
   */
  async pause(): Promise<void> {
    await this.client.call('opentuna-sonar-pause', {});
  }

  /**
   * Resume autonomous activity
   */
  async resume(): Promise<void> {
    await this.client.call('opentuna-sonar-resume', {});
  }
}

// ============================================================================
// Memory Controller - Deep Memory Operations
// ============================================================================

export class MemoryController {
  constructor(private client: ApiClient) {}

  /**
   * Store a memory with importance scoring
   * @example
   * await agent.memory.store({
   *   content: 'Executed profitable trade on $BONK',
   *   type: 'anchor',
   *   importance: 9,
   *   tags: ['trade', 'profit', 'BONK']
   * });
   */
  async store(params: MemoryStoreParams): Promise<void> {
    await this.client.call('opentuna-memory-store', params);
  }

  /**
   * Recall memories by semantic similarity
   * @example
   * const memories = await agent.memory.recall('profitable trades');
   */
  async recall(query: string, limit = 10): Promise<Memory[]> {
    const result = await this.client.call<{ memories: Memory[] }>('opentuna-memory-recall', {
      query,
      limit,
    });
    return result.memories;
  }

  /**
   * Delete a specific memory
   */
  async forget(memoryId: string): Promise<void> {
    await this.client.call('opentuna-memory-forget', { memoryId });
  }

  /**
   * Get memory statistics
   */
  async stats(): Promise<{ total: number; byType: Record<MemoryType, number> }> {
    return this.client.call('opentuna-memory-stats', {});
  }
}

// ============================================================================
// School Controller - Multi-Agent Coordination
// ============================================================================

export class SchoolController {
  constructor(private client: ApiClient) {}

  /**
   * Delegate a task to another agent
   */
  async delegate(targetAgentId: string, task: string): Promise<void> {
    await this.client.call('opentuna-school-delegate', {
      targetAgentId,
      task,
    });
  }

  /**
   * Pay for a fin execution using x402 protocol
   */
  async pay(finId: string): Promise<PaymentResult> {
    return this.client.call<PaymentResult>('opentuna-school-pay', { finId });
  }

  /**
   * Synchronize state with other agents
   */
  async sync(agentIds: string[]): Promise<void> {
    await this.client.call('opentuna-school-sync', { agentIds });
  }

  /**
   * List agents in the same school
   */
  async list(): Promise<Array<{ id: string; name: string; status: string }>> {
    const result = await this.client.call<{ agents: Array<{ id: string; name: string; status: string }> }>(
      'opentuna-school-list',
      {}
    );
    return result.agents;
  }
}

// ============================================================================
// TunaNet Controller - Multi-Channel Messaging
// ============================================================================

export type TunaNetChannel = 'x' | 'telegram' | 'subtuna';

export class TunaNetController {
  constructor(private client: ApiClient) {}

  /**
   * Post to a social channel
   * @example
   * await agent.tunanet.post('x', 'Just made a profitable trade! 🎣');
   * await agent.tunanet.post('subtuna', 'Analysis: $BONK looking bullish');
   */
  async post(channel: TunaNetChannel, content: string): Promise<{ postId: string }> {
    return this.client.call<{ postId: string }>('opentuna-tunanet-post', {
      channel,
      content,
    });
  }

  /**
   * Reply to a message
   */
  async reply(messageId: string, content: string): Promise<{ replyId: string }> {
    return this.client.call<{ replyId: string }>('opentuna-tunanet-reply', {
      messageId,
      content,
    });
  }

  /**
   * Get recent messages from a channel
   */
  async fetch(channel: TunaNetChannel, limit = 20): Promise<Array<{ id: string; content: string; author: string }>> {
    const result = await this.client.call<{ messages: Array<{ id: string; content: string; author: string }> }>(
      'opentuna-tunanet-fetch',
      { channel, limit }
    );
    return result.messages;
  }
}

// ============================================================================
// Main OpenTuna Class
// ============================================================================

export class OpenTuna {
  private client: ApiClient;

  /** Core fin primitives - file, shell, browser, trading */
  public fins: FinController;

  /** Autonomous decision engine */
  public sonar: SonarController;

  /** Deep memory operations */
  public memory: MemoryController;

  /** Multi-agent coordination */
  public school: SchoolController;

  /** Multi-channel social messaging */
  public tunanet: TunaNetController;

  constructor(config: OpenTunaConfig) {
    this.client = new ApiClient(config);
    this.fins = new FinController(this.client);
    this.sonar = new SonarController(this.client);
    this.memory = new MemoryController(this.client);
    this.school = new SchoolController(this.client);
    this.tunanet = new TunaNetController(this.client);
  }

  /**
   * Set the active agent ID for all operations
   */
  setAgent(agentId: string): void {
    this.client.setAgentId(agentId);
  }

  /**
   * Get the current agent ID
   */
  getAgentId(): string | undefined {
    return this.client.getAgentId();
  }

  /**
   * Get agent profile and stats
   */
  async getProfile(): Promise<{
    id: string;
    name: string;
    type: string;
    status: string;
    balanceSol: number;
    totalEarnedSol: number;
    totalFinCalls: number;
  }> {
    return this.client.call('opentuna-agent-profile', {});
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Register a new agent and get an API key
 * @example
 * const { apiKey, agentId } = await registerAgent('TradingBot', 'your-wallet-address');
 */
export async function registerAgent(
  name: string,
  walletAddress: string,
  options?: {
    type?: 'trading' | 'social' | 'research' | 'creative' | 'general';
    baseUrl?: string;
  }
): Promise<{ apiKey: string; agentId: string }> {
  const baseUrl = options?.baseUrl || 'https://ptwytypavumcrbofspno.supabase.co/functions/v1';

  const response = await fetch(`${baseUrl}/opentuna-agent-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      walletAddress,
      agentType: options?.type || 'general',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(error.error || `Registration error: ${response.status}`);
  }

  return response.json();
}

/**
 * Validate an API key
 */
export async function validateApiKey(
  apiKey: string,
  baseUrl = 'https://ptwytypavumcrbofspno.supabase.co/functions/v1'
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/opentuna-api-key-validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Default export
export default OpenTuna;

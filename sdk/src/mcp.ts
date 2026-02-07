/**
 * OpenTuna MCP Controller
 * Model Context Protocol support for 700+ community tools
 * 
 * @example
 * ```typescript
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Connect to a GitHub MCP server
 * await agent.mcp.connect('https://mcp.github.com');
 * 
 * // List available tools
 * const tools = await agent.mcp.listTools('https://mcp.github.com');
 * 
 * // Execute a tool
 * await agent.mcp.execute('https://mcp.github.com', 'create_issue', {
 *   repo: 'owner/repo',
 *   title: 'Bug Report',
 *   body: 'Description here'
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface McpServer {
  url: string;
  name: string;
  version: string;
  description?: string;
  tools: McpTool[];
  resources?: McpResource[];
  prompts?: McpPrompt[];
  status: 'connected' | 'disconnected' | 'error';
  connectedAt?: string;
  error?: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, McpToolProperty>;
    required?: string[];
  };
}

export interface McpToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: McpToolProperty;
  default?: unknown;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
}

export interface McpExecuteResult {
  success: boolean;
  content: McpContent[];
  isError?: boolean;
}

export interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string; // base64 for images
  mimeType?: string;
  uri?: string;
}

export interface McpReadResult {
  success: boolean;
  contents: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string; // base64
  }[];
}

export interface McpPromptResult {
  success: boolean;
  messages: {
    role: 'user' | 'assistant';
    content: McpContent;
  }[];
}

// Popular MCP servers
export const PopularServers = {
  GITHUB: 'https://mcp.github.com',
  SLACK: 'https://mcp.slack.com',
  NOTION: 'https://mcp.notion.so',
  LINEAR: 'https://mcp.linear.app',
  FIGMA: 'https://mcp.figma.com',
  AIRTABLE: 'https://mcp.airtable.com',
  JIRA: 'https://mcp.atlassian.com/jira',
  CONFLUENCE: 'https://mcp.atlassian.com/confluence',
  GOOGLE_DRIVE: 'https://mcp.google.com/drive',
  GOOGLE_SHEETS: 'https://mcp.google.com/sheets',
  GOOGLE_DOCS: 'https://mcp.google.com/docs',
  GOOGLE_CALENDAR: 'https://mcp.google.com/calendar',
  DROPBOX: 'https://mcp.dropbox.com',
  STRIPE: 'https://mcp.stripe.com',
  TWILIO: 'https://mcp.twilio.com',
  SENDGRID: 'https://mcp.sendgrid.com',
  MAILCHIMP: 'https://mcp.mailchimp.com',
  HUBSPOT: 'https://mcp.hubspot.com',
  SALESFORCE: 'https://mcp.salesforce.com',
  ZENDESK: 'https://mcp.zendesk.com',
  INTERCOM: 'https://mcp.intercom.com',
  MONGODB: 'https://mcp.mongodb.com',
  POSTGRES: 'https://mcp.postgres.dev',
  REDIS: 'https://mcp.redis.io',
  ELASTICSEARCH: 'https://mcp.elastic.co',
  CLOUDFLARE: 'https://mcp.cloudflare.com',
  VERCEL: 'https://mcp.vercel.com',
  NETLIFY: 'https://mcp.netlify.com',
  AWS: 'https://mcp.aws.amazon.com',
  GCP: 'https://mcp.cloud.google.com',
  AZURE: 'https://mcp.azure.microsoft.com',
} as const;

// ============================================================================
// MCP Controller
// ============================================================================

export class McpController {
  private baseUrl: string;
  private apiKey: string;
  private agentId?: string;

  constructor(baseUrl: string, apiKey: string, agentId?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.agentId = agentId;
  }

  private async call<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
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

  /**
   * Connect to an MCP server
   */
  async connect(serverUrl: string, auth?: {
    type: 'bearer' | 'basic' | 'api_key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  }): Promise<McpServer> {
    return this.call('opentuna-mcp-connect', { serverUrl, auth });
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverUrl: string): Promise<{ success: boolean }> {
    return this.call('opentuna-mcp-disconnect', { serverUrl });
  }

  /**
   * List connected servers
   */
  async listConnected(): Promise<McpServer[]> {
    return this.call('opentuna-mcp-servers', { action: 'list' });
  }

  /**
   * Get server info
   */
  async getServer(serverUrl: string): Promise<McpServer> {
    return this.call('opentuna-mcp-servers', { action: 'get', serverUrl });
  }

  /**
   * List tools available on a server
   */
  async listTools(serverUrl: string): Promise<McpTool[]> {
    return this.call('opentuna-mcp-tools', { serverUrl });
  }

  /**
   * Execute a tool on an MCP server
   */
  async execute(
    serverUrl: string, 
    toolName: string, 
    args: Record<string, unknown>
  ): Promise<McpExecuteResult> {
    return this.call('opentuna-mcp-execute', { serverUrl, toolName, args });
  }

  /**
   * List resources on a server
   */
  async listResources(serverUrl: string): Promise<McpResource[]> {
    return this.call('opentuna-mcp-resources', { serverUrl, action: 'list' });
  }

  /**
   * Read a resource
   */
  async readResource(serverUrl: string, uri: string): Promise<McpReadResult> {
    return this.call('opentuna-mcp-resources', { serverUrl, action: 'read', uri });
  }

  /**
   * List prompts on a server
   */
  async listPrompts(serverUrl: string): Promise<McpPrompt[]> {
    return this.call('opentuna-mcp-prompts', { serverUrl, action: 'list' });
  }

  /**
   * Get a prompt with arguments
   */
  async getPrompt(
    serverUrl: string, 
    promptName: string, 
    args?: Record<string, string>
  ): Promise<McpPromptResult> {
    return this.call('opentuna-mcp-prompts', { serverUrl, action: 'get', promptName, args });
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeResource(serverUrl: string, uri: string): Promise<{ subscriptionId: string }> {
    return this.call('opentuna-mcp-subscribe', { serverUrl, uri, type: 'resource' });
  }

  /**
   * Unsubscribe from updates
   */
  async unsubscribe(subscriptionId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-mcp-unsubscribe', { subscriptionId });
  }

  /**
   * Search for MCP servers in the registry
   */
  async search(query: string, category?: string): Promise<{
    servers: {
      url: string;
      name: string;
      description: string;
      category: string;
      verified: boolean;
      stars: number;
    }[];
  }> {
    return this.call('opentuna-mcp-search', { query, category });
  }

  /**
   * Get popular/featured MCP servers
   */
  async featured(): Promise<{
    servers: {
      url: string;
      name: string;
      description: string;
      category: string;
      toolCount: number;
    }[];
  }> {
    return this.call('opentuna-mcp-featured', {});
  }

  /**
   * Test connection to a server
   */
  async ping(serverUrl: string): Promise<{ 
    success: boolean; 
    latencyMs: number;
    version?: string;
  }> {
    return this.call('opentuna-mcp-ping', { serverUrl });
  }

  /**
   * Get usage statistics
   */
  async stats(): Promise<{
    connectedServers: number;
    totalToolCalls: number;
    toolCallsToday: number;
    topTools: { name: string; server: string; calls: number }[];
  }> {
    return this.call('opentuna-mcp-stats', {});
  }

  /**
   * Get preset server URLs
   */
  getPopularServers(): typeof PopularServers {
    return PopularServers;
  }

  /**
   * Helper to connect to a popular server by name
   */
  async connectPopular(
    serverName: keyof typeof PopularServers, 
    auth?: Parameters<typeof this.connect>[1]
  ): Promise<McpServer> {
    const url = PopularServers[serverName];
    return this.connect(url, auth);
  }
}

export { PopularServers };
export default McpController;

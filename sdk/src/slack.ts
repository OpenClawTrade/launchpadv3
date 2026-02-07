/**
 * OpenTuna Slack Controller
 * Full Slack workspace integration for messaging, channels, and reactions
 * 
 * @example
 * ```typescript
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Post to channel
 * await agent.slack.postMessage('#general', 'Hello from OpenTuna!');
 * 
 * // Reply in thread
 * await agent.slack.reply(threadTs, 'Following up on this...');
 * 
 * // React to message
 * await agent.slack.react(messageTs, 'rocket');
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
  memberCount: number;
  topic?: string;
  purpose?: string;
  createdAt: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  displayName: string;
  email?: string;
  avatarUrl: string;
  isBot: boolean;
  isAdmin: boolean;
  timezone?: string;
  status?: {
    text: string;
    emoji: string;
    expiresAt?: string;
  };
}

export interface SlackMessage {
  ts: string;
  channelId: string;
  userId: string;
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  threadTs?: string;
  replyCount?: number;
  reactions?: SlackReaction[];
  files?: SlackFile[];
  isEdited: boolean;
  timestamp: string;
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions' | 'image';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
  };
  accessory?: Record<string, unknown>;
  elements?: Record<string, unknown>[];
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  title?: string;
  titleLink?: string;
  text?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  imageUrl?: string;
  thumbUrl?: string;
  footer?: string;
  ts?: number;
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

export interface PostMessageParams {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  threadTs?: string;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
}

export interface FetchMessagesParams {
  channel: string;
  limit?: number;
  cursor?: string;
  oldest?: string;
  latest?: string;
  inclusive?: boolean;
}

export interface SearchMessagesParams {
  query: string;
  count?: number;
  page?: number;
  sort?: 'score' | 'timestamp';
  sortDir?: 'asc' | 'desc';
}

export interface SlackMessageResult {
  success: boolean;
  ts: string;
  channel: string;
}

// ============================================================================
// Slack Controller
// ============================================================================

export class SlackController {
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
   * Connect Slack workspace via OAuth
   */
  async connect(): Promise<{ authUrl: string; state: string }> {
    return this.call('opentuna-slack-connect', {});
  }

  /**
   * Complete OAuth flow
   */
  async completeAuth(code: string, state: string): Promise<{ success: boolean; teamName: string }> {
    return this.call('opentuna-slack-auth', { code, state });
  }

  /**
   * Post a message to a channel
   */
  async postMessage(channel: string, text: string, options?: Omit<PostMessageParams, 'channel' | 'text'>): Promise<SlackMessageResult> {
    return this.call('opentuna-slack-post', { channel, text, ...options });
  }

  /**
   * Post message with blocks (rich formatting)
   */
  async postBlocks(channel: string, blocks: SlackBlock[], text?: string): Promise<SlackMessageResult> {
    return this.call('opentuna-slack-post', { channel, blocks, text: text || 'Message' });
  }

  /**
   * Reply to a thread
   */
  async reply(threadTs: string, channel: string, text: string, broadcast?: boolean): Promise<SlackMessageResult> {
    return this.call('opentuna-slack-post', { 
      channel, 
      text, 
      threadTs,
      replyBroadcast: broadcast 
    });
  }

  /**
   * Fetch messages from a channel
   */
  async fetchMessages(params: FetchMessagesParams | string): Promise<{ messages: SlackMessage[]; hasMore: boolean; cursor?: string }> {
    const fetchParams = typeof params === 'string' ? { channel: params } : params;
    return this.call('opentuna-slack-fetch', fetchParams);
  }

  /**
   * Get thread replies
   */
  async getThread(channel: string, threadTs: string): Promise<{ messages: SlackMessage[] }> {
    return this.call('opentuna-slack-thread', { channel, threadTs });
  }

  /**
   * React to a message
   */
  async react(channel: string, timestamp: string, emoji: string): Promise<{ success: boolean }> {
    return this.call('opentuna-slack-react', { channel, timestamp, emoji, action: 'add' });
  }

  /**
   * Remove a reaction
   */
  async unreact(channel: string, timestamp: string, emoji: string): Promise<{ success: boolean }> {
    return this.call('opentuna-slack-react', { channel, timestamp, emoji, action: 'remove' });
  }

  /**
   * Edit a message
   */
  async updateMessage(channel: string, ts: string, text: string, blocks?: SlackBlock[]): Promise<SlackMessageResult> {
    return this.call('opentuna-slack-update', { channel, ts, text, blocks });
  }

  /**
   * Delete a message
   */
  async deleteMessage(channel: string, ts: string): Promise<{ success: boolean }> {
    return this.call('opentuna-slack-delete', { channel, ts });
  }

  /**
   * List all channels
   */
  async listChannels(includePrivate?: boolean): Promise<SlackChannel[]> {
    return this.call('opentuna-slack-channels', { action: 'list', includePrivate });
  }

  /**
   * Get channel info
   */
  async getChannel(channelId: string): Promise<SlackChannel> {
    return this.call('opentuna-slack-channels', { action: 'get', channelId });
  }

  /**
   * Join a channel
   */
  async joinChannel(channel: string): Promise<{ success: boolean; channel: SlackChannel }> {
    return this.call('opentuna-slack-channels', { action: 'join', channel });
  }

  /**
   * Leave a channel
   */
  async leaveChannel(channel: string): Promise<{ success: boolean }> {
    return this.call('opentuna-slack-channels', { action: 'leave', channel });
  }

  /**
   * Create a new channel
   */
  async createChannel(name: string, isPrivate?: boolean): Promise<SlackChannel> {
    return this.call('opentuna-slack-channels', { action: 'create', name, isPrivate });
  }

  /**
   * Get user info
   */
  async getUser(userId: string): Promise<SlackUser> {
    return this.call('opentuna-slack-users', { action: 'get', userId });
  }

  /**
   * List workspace members
   */
  async listUsers(limit?: number, cursor?: string): Promise<{ users: SlackUser[]; cursor?: string }> {
    return this.call('opentuna-slack-users', { action: 'list', limit, cursor });
  }

  /**
   * Send direct message to user
   */
  async sendDM(userId: string, text: string, blocks?: SlackBlock[]): Promise<SlackMessageResult> {
    return this.call('opentuna-slack-dm', { userId, text, blocks });
  }

  /**
   * Search messages
   */
  async search(params: SearchMessagesParams | string): Promise<{ messages: SlackMessage[]; total: number }> {
    const searchParams = typeof params === 'string' ? { query: params } : params;
    return this.call('opentuna-slack-search', searchParams);
  }

  /**
   * Upload a file
   */
  async uploadFile(
    channel: string, 
    content: string, 
    filename: string, 
    options?: { title?: string; initialComment?: string }
  ): Promise<{ success: boolean; file: SlackFile }> {
    return this.call('opentuna-slack-file', { 
      action: 'upload', 
      channel, 
      content, 
      filename,
      ...options 
    });
  }

  /**
   * Set channel topic
   */
  async setTopic(channel: string, topic: string): Promise<{ success: boolean }> {
    return this.call('opentuna-slack-channels', { action: 'setTopic', channel, topic });
  }

  /**
   * Set channel purpose
   */
  async setPurpose(channel: string, purpose: string): Promise<{ success: boolean }> {
    return this.call('opentuna-slack-channels', { action: 'setPurpose', channel, purpose });
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{ 
    connected: boolean; 
    teamId?: string; 
    teamName?: string;
    botUserId?: string;
  }> {
    return this.call('opentuna-slack-status', {});
  }

  /**
   * Disconnect Slack workspace
   */
  async disconnect(): Promise<{ success: boolean }> {
    return this.call('opentuna-slack-disconnect', {});
  }

  /**
   * Set up webhook for events
   */
  async setupWebhook(
    webhookUrl: string, 
    events: ('message' | 'reaction' | 'channel_created' | 'member_joined')[]
  ): Promise<{ success: boolean; webhookId: string }> {
    return this.call('opentuna-slack-webhook', { action: 'setup', webhookUrl, events });
  }
}

export default SlackController;

/**
 * OpenTuna Discord Controller
 * Full Discord bot integration for servers, channels, and messaging
 * 
 * @example
 * ```typescript
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Send message to channel
 * await agent.discord.sendMessage('channel-id', 'Hello from OpenTuna!');
 * 
 * // Create embed
 * await agent.discord.sendEmbed('channel-id', {
 *   title: 'Trade Alert',
 *   description: 'New position opened!',
 *   color: 0x00ff00
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  ownerId: string;
  memberCount: number;
  channels: DiscordChannel[];
  roles: DiscordRole[];
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'category' | 'announcement' | 'forum' | 'thread';
  parentId?: string;
  position: number;
  topic?: string;
  nsfw: boolean;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  mentionable: boolean;
}

export interface DiscordUser {
  id: string;
  username: string;
  displayName: string;
  discriminator: string;
  avatar?: string;
  bot: boolean;
}

export interface DiscordMember {
  user: DiscordUser;
  nickname?: string;
  roles: string[];
  joinedAt: string;
}

export interface DiscordMessage {
  id: string;
  channelId: string;
  author: DiscordUser;
  content: string;
  embeds: DiscordEmbed[];
  attachments: DiscordAttachment[];
  reactions: DiscordReaction[];
  referencedMessage?: DiscordMessage;
  timestamp: string;
  editedAt?: string;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: { text: string; iconUrl?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; iconUrl?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  contentType?: string;
}

export interface DiscordReaction {
  emoji: string;
  count: number;
  me: boolean;
}

export interface SendMessageParams {
  channelId: string;
  content?: string;
  embeds?: DiscordEmbed[];
  replyTo?: string;
  allowMentions?: boolean;
}

export interface CreateThreadParams {
  channelId: string;
  name: string;
  messageId?: string;
  autoArchiveDuration?: 60 | 1440 | 4320 | 10080;
}

export interface DiscordMessageResult {
  success: boolean;
  messageId: string;
  channelId: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  options?: SlashCommandOption[];
}

export interface SlashCommandOption {
  name: string;
  description: string;
  type: 'string' | 'integer' | 'boolean' | 'user' | 'channel' | 'role';
  required?: boolean;
  choices?: { name: string; value: string | number }[];
}

// ============================================================================
// Discord Controller
// ============================================================================

export class DiscordController {
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
   * Configure Discord bot token
   */
  async configure(botToken: string): Promise<{ success: boolean; botUser: DiscordUser }> {
    return this.call('opentuna-discord-configure', { botToken });
  }

  /**
   * Generate OAuth URL for bot invite
   */
  async getInviteUrl(permissions?: string[]): Promise<{ url: string }> {
    return this.call('opentuna-discord-invite', { permissions });
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, content: string, options?: { replyTo?: string }): Promise<DiscordMessageResult> {
    return this.call('opentuna-discord-send', { 
      channelId, 
      content,
      ...options 
    });
  }

  /**
   * Send an embed message
   */
  async sendEmbed(channelId: string, embed: DiscordEmbed): Promise<DiscordMessageResult> {
    return this.call('opentuna-discord-send', { channelId, embeds: [embed] });
  }

  /**
   * Send multiple embeds
   */
  async sendEmbeds(channelId: string, embeds: DiscordEmbed[]): Promise<DiscordMessageResult> {
    return this.call('opentuna-discord-send', { channelId, embeds });
  }

  /**
   * Reply to a message
   */
  async reply(channelId: string, messageId: string, content: string): Promise<DiscordMessageResult> {
    return this.call('opentuna-discord-send', { channelId, content, replyTo: messageId });
  }

  /**
   * Edit a message
   */
  async editMessage(channelId: string, messageId: string, content?: string, embeds?: DiscordEmbed[]): Promise<DiscordMessageResult> {
    return this.call('opentuna-discord-edit', { channelId, messageId, content, embeds });
  }

  /**
   * Delete a message
   */
  async deleteMessage(channelId: string, messageId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-discord-delete', { channelId, messageId });
  }

  /**
   * Add reaction to message
   */
  async addReaction(channelId: string, messageId: string, emoji: string): Promise<{ success: boolean }> {
    return this.call('opentuna-discord-react', { channelId, messageId, emoji, action: 'add' });
  }

  /**
   * Remove reaction from message
   */
  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<{ success: boolean }> {
    return this.call('opentuna-discord-react', { channelId, messageId, emoji, action: 'remove' });
  }

  /**
   * Fetch messages from channel
   */
  async fetchMessages(channelId: string, limit?: number, before?: string, after?: string): Promise<DiscordMessage[]> {
    return this.call('opentuna-discord-fetch', { channelId, limit, before, after });
  }

  /**
   * Get a specific message
   */
  async getMessage(channelId: string, messageId: string): Promise<DiscordMessage> {
    return this.call('opentuna-discord-fetch', { channelId, messageId, single: true });
  }

  /**
   * Create a thread
   */
  async createThread(params: CreateThreadParams): Promise<{ channelId: string; name: string }> {
    return this.call('opentuna-discord-thread', { action: 'create', ...params });
  }

  /**
   * Get thread messages
   */
  async getThread(threadId: string, limit?: number): Promise<DiscordMessage[]> {
    return this.call('opentuna-discord-thread', { action: 'messages', threadId, limit });
  }

  /**
   * List guilds (servers) the bot is in
   */
  async listGuilds(): Promise<DiscordGuild[]> {
    return this.call('opentuna-discord-guilds', { action: 'list' });
  }

  /**
   * Get guild info
   */
  async getGuild(guildId: string): Promise<DiscordGuild> {
    return this.call('opentuna-discord-guilds', { action: 'get', guildId });
  }

  /**
   * List channels in a guild
   */
  async listChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.call('opentuna-discord-channels', { action: 'list', guildId });
  }

  /**
   * Create a channel
   */
  async createChannel(guildId: string, name: string, type: 'text' | 'voice', parentId?: string): Promise<DiscordChannel> {
    return this.call('opentuna-discord-channels', { action: 'create', guildId, name, type, parentId });
  }

  /**
   * Delete a channel
   */
  async deleteChannel(channelId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-discord-channels', { action: 'delete', channelId });
  }

  /**
   * List guild members
   */
  async listMembers(guildId: string, limit?: number): Promise<DiscordMember[]> {
    return this.call('opentuna-discord-members', { action: 'list', guildId, limit });
  }

  /**
   * Get member info
   */
  async getMember(guildId: string, userId: string): Promise<DiscordMember> {
    return this.call('opentuna-discord-members', { action: 'get', guildId, userId });
  }

  /**
   * Add role to member
   */
  async addRole(guildId: string, userId: string, roleId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-discord-roles', { action: 'add', guildId, userId, roleId });
  }

  /**
   * Remove role from member
   */
  async removeRole(guildId: string, userId: string, roleId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-discord-roles', { action: 'remove', guildId, userId, roleId });
  }

  /**
   * Create a role
   */
  async createRole(guildId: string, name: string, color?: number, permissions?: string[]): Promise<DiscordRole> {
    return this.call('opentuna-discord-roles', { action: 'create', guildId, name, color, permissions });
  }

  /**
   * Send direct message to user
   */
  async sendDM(userId: string, content: string, embed?: DiscordEmbed): Promise<DiscordMessageResult> {
    return this.call('opentuna-discord-dm', { userId, content, embeds: embed ? [embed] : undefined });
  }

  /**
   * Register slash commands
   */
  async registerCommands(guildId: string, commands: SlashCommand[]): Promise<{ success: boolean; count: number }> {
    return this.call('opentuna-discord-commands', { action: 'register', guildId, commands });
  }

  /**
   * List registered commands
   */
  async listCommands(guildId: string): Promise<SlashCommand[]> {
    return this.call('opentuna-discord-commands', { action: 'list', guildId });
  }

  /**
   * Delete a command
   */
  async deleteCommand(guildId: string, commandId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-discord-commands', { action: 'delete', guildId, commandId });
  }

  /**
   * Set up webhook for events
   */
  async setupWebhook(
    webhookUrl: string,
    events: ('message' | 'reaction' | 'member_join' | 'command')[]
  ): Promise<{ success: boolean; webhookId: string }> {
    return this.call('opentuna-discord-webhook', { action: 'setup', webhookUrl, events });
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    botUser?: DiscordUser;
    guildCount?: number;
  }> {
    return this.call('opentuna-discord-status', {});
  }

  /**
   * Disconnect bot
   */
  async disconnect(): Promise<{ success: boolean }> {
    return this.call('opentuna-discord-disconnect', {});
  }
}

export default DiscordController;

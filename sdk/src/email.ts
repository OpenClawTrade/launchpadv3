/**
 * OpenTuna Email Controller
 * Gmail/Outlook inbox management, sending, and OTP extraction
 * 
 * @example
 * ```typescript
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Fetch inbox
 * const messages = await agent.email.fetchInbox(10);
 * 
 * // Send email
 * await agent.email.send({
 *   to: 'user@example.com',
 *   subject: 'Trade Alert',
 *   body: 'Your position hit take-profit!'
 * });
 * 
 * // Extract OTP from email
 * const otp = await agent.email.extractOTP(messageId);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface EmailConfig {
  provider: 'gmail' | 'outlook';
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments: EmailAttachment[];
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  receivedAt: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64 encoded
}

export interface EmailThread {
  id: string;
  subject: string;
  messages: EmailMessage[];
  snippet: string;
  participantCount: number;
  lastMessageAt: string;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: {
    filename: string;
    content: string; // base64
    mimeType: string;
  }[];
  replyToMessageId?: string;
}

export interface FetchInboxParams {
  limit?: number;
  offset?: number;
  labels?: string[];
  isUnread?: boolean;
  from?: string;
  subject?: string;
  after?: string; // ISO date
  before?: string; // ISO date
}

export interface SearchEmailParams {
  query: string;
  limit?: number;
  includeSpam?: boolean;
  includeTrash?: boolean;
}

export interface EmailSendResult {
  success: boolean;
  messageId: string;
  threadId: string;
}

export interface OTPExtractResult {
  success: boolean;
  otp: string | null;
  confidence: number;
  source: 'body' | 'subject';
}

// ============================================================================
// Email Controller
// ============================================================================

export class EmailController {
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
   * Connect email account via OAuth
   * Returns URL to redirect user for authentication
   */
  async connect(provider: 'gmail' | 'outlook'): Promise<{ authUrl: string; state: string }> {
    return this.call('opentuna-email-connect', { provider });
  }

  /**
   * Complete OAuth flow with authorization code
   */
  async completeAuth(code: string, state: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-auth', { code, state });
  }

  /**
   * Send an email
   */
  async send(params: SendEmailParams): Promise<EmailSendResult> {
    return this.call('opentuna-email-send', params);
  }

  /**
   * Fetch inbox messages
   */
  async fetchInbox(params: FetchInboxParams | number = 20): Promise<EmailMessage[]> {
    const fetchParams = typeof params === 'number' ? { limit: params } : params;
    return this.call('opentuna-email-fetch', { action: 'inbox', ...fetchParams });
  }

  /**
   * Get a specific thread with all messages
   */
  async getThread(threadId: string): Promise<EmailThread> {
    return this.call('opentuna-email-fetch', { action: 'thread', threadId });
  }

  /**
   * Get a specific message
   */
  async getMessage(messageId: string): Promise<EmailMessage> {
    return this.call('opentuna-email-fetch', { action: 'message', messageId });
  }

  /**
   * Reply to an email
   */
  async reply(messageId: string, body: string, bodyHtml?: string): Promise<EmailSendResult> {
    return this.call('opentuna-email-reply', { messageId, body, bodyHtml });
  }

  /**
   * Forward an email
   */
  async forward(messageId: string, to: string | string[], message?: string): Promise<EmailSendResult> {
    return this.call('opentuna-email-forward', { 
      messageId, 
      to: Array.isArray(to) ? to : [to],
      message 
    });
  }

  /**
   * Extract OTP/verification code from email
   * Uses pattern matching to find 4-8 digit codes
   */
  async extractOTP(messageId: string): Promise<OTPExtractResult> {
    return this.call('opentuna-email-extract-otp', { messageId });
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-modify', { messageId, action: 'markRead' });
  }

  /**
   * Mark message as unread
   */
  async markAsUnread(messageId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-modify', { messageId, action: 'markUnread' });
  }

  /**
   * Star/unstar a message
   */
  async toggleStar(messageId: string, starred: boolean): Promise<{ success: boolean }> {
    return this.call('opentuna-email-modify', { 
      messageId, 
      action: starred ? 'star' : 'unstar' 
    });
  }

  /**
   * Move message to trash
   */
  async trash(messageId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-modify', { messageId, action: 'trash' });
  }

  /**
   * Permanently delete message
   */
  async delete(messageId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-modify', { messageId, action: 'delete' });
  }

  /**
   * Archive message (remove from inbox)
   */
  async archive(messageId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-modify', { messageId, action: 'archive' });
  }

  /**
   * Add label to message
   */
  async addLabel(messageId: string, label: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-modify', { messageId, action: 'addLabel', label });
  }

  /**
   * Remove label from message
   */
  async removeLabel(messageId: string, label: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-modify', { messageId, action: 'removeLabel', label });
  }

  /**
   * Search emails with query
   */
  async search(params: SearchEmailParams | string): Promise<EmailMessage[]> {
    const searchParams = typeof params === 'string' ? { query: params } : params;
    return this.call('opentuna-email-search', searchParams);
  }

  /**
   * Get list of labels/folders
   */
  async listLabels(): Promise<{ id: string; name: string; type: string }[]> {
    return this.call('opentuna-email-labels', { action: 'list' });
  }

  /**
   * Create a new label
   */
  async createLabel(name: string): Promise<{ id: string; name: string }> {
    return this.call('opentuna-email-labels', { action: 'create', name });
  }

  /**
   * Get attachment content
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<{ data: string; mimeType: string }> {
    return this.call('opentuna-email-attachment', { messageId, attachmentId });
  }

  /**
   * Check connection status
   */
  async getStatus(): Promise<{ 
    connected: boolean; 
    provider?: 'gmail' | 'outlook'; 
    email?: string;
    expiresAt?: string;
  }> {
    return this.call('opentuna-email-status', {});
  }

  /**
   * Disconnect email account
   */
  async disconnect(): Promise<{ success: boolean }> {
    return this.call('opentuna-email-disconnect', {});
  }

  /**
   * Set up email webhook for real-time notifications
   */
  async setupWebhook(webhookUrl: string, events: ('new_message' | 'thread_reply')[]): Promise<{ 
    success: boolean; 
    webhookId: string 
  }> {
    return this.call('opentuna-email-webhook', { action: 'setup', webhookUrl, events });
  }

  /**
   * Remove email webhook
   */
  async removeWebhook(webhookId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-email-webhook', { action: 'remove', webhookId });
  }
}

export default EmailController;

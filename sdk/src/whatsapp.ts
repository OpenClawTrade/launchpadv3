/**
 * OpenTuna WhatsApp Controller
 * WhatsApp Business API integration for messaging and automation
 * 
 * @example
 * ```typescript
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Send message
 * await agent.whatsapp.sendMessage('+1234567890', 'Hello from OpenTuna!');
 * 
 * // Send template message
 * await agent.whatsapp.sendTemplate('+1234567890', 'order_confirmation', {
 *   order_id: '12345',
 *   amount: '$99.99'
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts' | 'template' | 'interactive';
  text?: string;
  media?: WhatsAppMedia;
  location?: WhatsAppLocation;
  contacts?: WhatsAppContact[];
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  context?: {
    messageId: string;
    from: string;
  };
}

export interface WhatsAppMedia {
  id: string;
  mimeType: string;
  url?: string;
  caption?: string;
  filename?: string;
  sha256?: string;
}

export interface WhatsAppLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppContact {
  name: {
    formattedName: string;
    firstName?: string;
    lastName?: string;
  };
  phones?: { phone: string; type: string }[];
  emails?: { email: string; type: string }[];
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
}

export interface SendMessageParams {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface SendTemplateParams {
  to: string;
  templateName: string;
  language?: string;
  components?: {
    type: 'header' | 'body' | 'button';
    parameters: { type: string; text?: string; image?: { link: string } }[];
  }[];
}

export interface SendMediaParams {
  to: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

export interface SendInteractiveParams {
  to: string;
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: { type: 'text' | 'image' | 'video' | 'document'; text?: string; image?: { link: string } };
  body: string;
  footer?: string;
  action: {
    buttons?: { type: 'reply'; reply: { id: string; title: string } }[];
    button?: string;
    sections?: { title: string; rows: { id: string; title: string; description?: string }[] }[];
  };
}

export interface WhatsAppMessageResult {
  success: boolean;
  messageId: string;
  to: string;
}

export interface WhatsAppConversation {
  id: string;
  contact: {
    waId: string;
    name?: string;
    phone: string;
  };
  messages: WhatsAppMessage[];
  lastMessageAt: string;
  unreadCount: number;
}

// ============================================================================
// WhatsApp Controller
// ============================================================================

export class WhatsAppController {
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
   * Configure WhatsApp Business API credentials
   */
  async configure(config: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
  }): Promise<{ success: boolean }> {
    return this.call('opentuna-whatsapp-configure', config);
  }

  /**
   * Send a text message
   */
  async sendMessage(to: string, text: string, previewUrl?: boolean): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', { 
      to: this.formatPhoneNumber(to), 
      type: 'text',
      text,
      previewUrl 
    });
  }

  /**
   * Send a template message
   */
  async sendTemplate(
    to: string, 
    templateName: string, 
    variables?: Record<string, string>,
    language?: string
  ): Promise<WhatsAppMessageResult> {
    const components = variables ? [{
      type: 'body',
      parameters: Object.values(variables).map(value => ({ type: 'text', text: value }))
    }] : [];

    return this.call('opentuna-whatsapp-send', { 
      to: this.formatPhoneNumber(to), 
      type: 'template',
      template: {
        name: templateName,
        language: { code: language || 'en' },
        components
      }
    });
  }

  /**
   * Send an image
   */
  async sendImage(to: string, imageUrl: string, caption?: string): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', {
      to: this.formatPhoneNumber(to),
      type: 'image',
      image: { link: imageUrl },
      caption
    });
  }

  /**
   * Send a video
   */
  async sendVideo(to: string, videoUrl: string, caption?: string): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', {
      to: this.formatPhoneNumber(to),
      type: 'video',
      video: { link: videoUrl },
      caption
    });
  }

  /**
   * Send an audio message
   */
  async sendAudio(to: string, audioUrl: string): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', {
      to: this.formatPhoneNumber(to),
      type: 'audio',
      audio: { link: audioUrl }
    });
  }

  /**
   * Send a document
   */
  async sendDocument(to: string, documentUrl: string, filename: string, caption?: string): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', {
      to: this.formatPhoneNumber(to),
      type: 'document',
      document: { link: documentUrl, filename },
      caption
    });
  }

  /**
   * Send location
   */
  async sendLocation(
    to: string, 
    latitude: number, 
    longitude: number, 
    name?: string, 
    address?: string
  ): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', {
      to: this.formatPhoneNumber(to),
      type: 'location',
      location: { latitude, longitude, name, address }
    });
  }

  /**
   * Send interactive buttons
   */
  async sendButtons(
    to: string,
    body: string,
    buttons: { id: string; title: string }[],
    header?: string,
    footer?: string
  ): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', {
      to: this.formatPhoneNumber(to),
      type: 'interactive',
      interactive: {
        type: 'button',
        header: header ? { type: 'text', text: header } : undefined,
        body: { text: body },
        footer: footer ? { text: footer } : undefined,
        action: {
          buttons: buttons.slice(0, 3).map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title.slice(0, 20) }
          }))
        }
      }
    });
  }

  /**
   * Send interactive list
   */
  async sendList(
    to: string,
    body: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
    header?: string,
    footer?: string
  ): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', {
      to: this.formatPhoneNumber(to),
      type: 'interactive',
      interactive: {
        type: 'list',
        header: header ? { type: 'text', text: header } : undefined,
        body: { text: body },
        footer: footer ? { text: footer } : undefined,
        action: {
          button: buttonText,
          sections
        }
      }
    });
  }

  /**
   * Reply to a message
   */
  async reply(messageId: string, to: string, text: string): Promise<WhatsAppMessageResult> {
    return this.call('opentuna-whatsapp-send', {
      to: this.formatPhoneNumber(to),
      type: 'text',
      text,
      context: { message_id: messageId }
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-whatsapp-read', { messageId });
  }

  /**
   * Fetch inbox (recent conversations)
   */
  async fetchInbox(limit?: number): Promise<WhatsAppConversation[]> {
    return this.call('opentuna-whatsapp-inbox', { limit: limit || 20 });
  }

  /**
   * Get conversation with a contact
   */
  async getConversation(phoneNumber: string, limit?: number): Promise<WhatsAppConversation> {
    return this.call('opentuna-whatsapp-conversation', { 
      phoneNumber: this.formatPhoneNumber(phoneNumber),
      limit 
    });
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<WhatsAppMessage> {
    return this.call('opentuna-whatsapp-message', { messageId });
  }

  /**
   * List available templates
   */
  async listTemplates(): Promise<WhatsAppTemplate[]> {
    return this.call('opentuna-whatsapp-templates', { action: 'list' });
  }

  /**
   * Get template by name
   */
  async getTemplate(templateName: string): Promise<WhatsAppTemplate> {
    return this.call('opentuna-whatsapp-templates', { action: 'get', templateName });
  }

  /**
   * Create a new template (requires Meta approval)
   */
  async createTemplate(template: {
    name: string;
    language: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    components: WhatsAppTemplateComponent[];
  }): Promise<{ success: boolean; templateId: string; status: string }> {
    return this.call('opentuna-whatsapp-templates', { action: 'create', ...template });
  }

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(
    content: string, // base64
    mimeType: string,
    filename?: string
  ): Promise<{ mediaId: string; url: string }> {
    return this.call('opentuna-whatsapp-media', { 
      action: 'upload', 
      content, 
      mimeType,
      filename 
    });
  }

  /**
   * Get media URL by ID
   */
  async getMedia(mediaId: string): Promise<{ url: string; mimeType: string; sha256: string }> {
    return this.call('opentuna-whatsapp-media', { action: 'get', mediaId });
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    phoneNumber?: string;
    displayName?: string;
    qualityRating?: string;
    messagingLimit?: string;
  }> {
    return this.call('opentuna-whatsapp-status', {});
  }

  /**
   * Set up webhook for incoming messages
   */
  async setupWebhook(
    webhookUrl: string,
    verifyToken: string
  ): Promise<{ success: boolean; webhookId: string }> {
    return this.call('opentuna-whatsapp-webhook', { 
      action: 'setup', 
      webhookUrl,
      verifyToken 
    });
  }

  /**
   * Disconnect WhatsApp
   */
  async disconnect(): Promise<{ success: boolean }> {
    return this.call('opentuna-whatsapp-disconnect', {});
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except leading +
    let formatted = phone.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!formatted.startsWith('+')) {
      // Assume US number if no country code
      if (formatted.length === 10) {
        formatted = '+1' + formatted;
      } else {
        formatted = '+' + formatted;
      }
    }
    
    return formatted;
  }
}

export default WhatsAppController;

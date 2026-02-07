/**
 * OpenTuna Notion Controller
 * Full Notion workspace integration for pages and databases
 * 
 * @example
 * ```typescript
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Create a page
 * await agent.notion.pages.create({
 *   parentId: 'database-id',
 *   title: 'Trade Log Entry',
 *   properties: {
 *     'Token': 'BONK',
 *     'Action': 'BUY',
 *     'Result': '+25%'
 *   }
 * });
 * 
 * // Query database
 * const entries = await agent.notion.databases.query('database-id', {
 *   filter: { property: 'Status', equals: 'Active' }
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  icon?: string | { type: 'emoji'; emoji: string } | { type: 'external'; url: string };
  cover?: { type: 'external'; url: string };
  properties: Record<string, NotionProperty>;
  content?: NotionBlock[];
  parentId?: string;
  parentType: 'database' | 'page' | 'workspace';
  createdAt: string;
  lastEditedAt: string;
  createdBy: string;
  lastEditedBy: string;
  archived: boolean;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  icon?: string | { type: 'emoji'; emoji: string };
  cover?: { type: 'external'; url: string };
  properties: Record<string, NotionPropertySchema>;
  parentId?: string;
  parentType: 'page' | 'workspace';
  createdAt: string;
  lastEditedAt: string;
  archived: boolean;
}

export interface NotionProperty {
  type: string;
  value: unknown;
}

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' | 'date' | 
        'people' | 'files' | 'checkbox' | 'url' | 'email' | 'phone_number' |
        'formula' | 'relation' | 'rollup' | 'created_time' | 'created_by' |
        'last_edited_time' | 'last_edited_by' | 'status';
  options?: { id: string; name: string; color: string }[];
}

export interface NotionBlock {
  id: string;
  type: 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' |
        'numbered_list_item' | 'to_do' | 'toggle' | 'code' | 'quote' | 'callout' |
        'divider' | 'image' | 'video' | 'file' | 'bookmark' | 'embed' | 'table' |
        'table_row' | 'column_list' | 'column' | 'synced_block';
  content: NotionRichText[];
  children?: NotionBlock[];
  metadata?: Record<string, unknown>;
}

export interface NotionRichText {
  type: 'text' | 'mention' | 'equation';
  text?: string;
  href?: string;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

export interface CreatePageParams {
  parentId: string;
  title: string;
  icon?: string;
  cover?: string;
  properties?: Record<string, unknown>;
  content?: (string | NotionBlock)[];
}

export interface UpdatePageParams {
  title?: string;
  icon?: string;
  cover?: string;
  properties?: Record<string, unknown>;
  archived?: boolean;
}

export interface QueryDatabaseParams {
  filter?: NotionFilter;
  sorts?: NotionSort[];
  startCursor?: string;
  pageSize?: number;
}

export interface NotionFilter {
  property?: string;
  type?: string;
  // Filter conditions
  equals?: unknown;
  does_not_equal?: unknown;
  contains?: string;
  does_not_contain?: string;
  starts_with?: string;
  ends_with?: string;
  is_empty?: boolean;
  is_not_empty?: boolean;
  greater_than?: number | string;
  less_than?: number | string;
  greater_than_or_equal_to?: number | string;
  less_than_or_equal_to?: number | string;
  before?: string;
  after?: string;
  on_or_before?: string;
  on_or_after?: string;
  // Compound filters
  and?: NotionFilter[];
  or?: NotionFilter[];
}

export interface NotionSort {
  property?: string;
  timestamp?: 'created_time' | 'last_edited_time';
  direction: 'ascending' | 'descending';
}

export interface CreateDatabaseParams {
  parentId: string;
  title: string;
  icon?: string;
  properties: Record<string, { type: string; options?: { name: string; color?: string }[] }>;
}

// ============================================================================
// Sub-Controllers
// ============================================================================

class PagesController {
  constructor(
    private call: <T>(endpoint: string, body: Record<string, unknown>) => Promise<T>
  ) {}

  async create(params: CreatePageParams): Promise<NotionPage> {
    return this.call('opentuna-notion-pages', { action: 'create', ...params });
  }

  async get(pageId: string): Promise<NotionPage> {
    return this.call('opentuna-notion-pages', { action: 'get', pageId });
  }

  async update(pageId: string, params: UpdatePageParams): Promise<NotionPage> {
    return this.call('opentuna-notion-pages', { action: 'update', pageId, ...params });
  }

  async archive(pageId: string): Promise<NotionPage> {
    return this.call('opentuna-notion-pages', { action: 'update', pageId, archived: true });
  }

  async restore(pageId: string): Promise<NotionPage> {
    return this.call('opentuna-notion-pages', { action: 'update', pageId, archived: false });
  }

  async getContent(pageId: string): Promise<NotionBlock[]> {
    return this.call('opentuna-notion-blocks', { action: 'list', blockId: pageId });
  }

  async appendContent(pageId: string, blocks: (string | NotionBlock)[]): Promise<NotionBlock[]> {
    return this.call('opentuna-notion-blocks', { action: 'append', blockId: pageId, blocks });
  }

  async search(query: string, options?: { 
    filter?: 'page' | 'database'; 
    sort?: 'relevance' | 'last_edited_time';
    pageSize?: number;
  }): Promise<NotionPage[]> {
    return this.call('opentuna-notion-search', { query, ...options });
  }
}

class DatabasesController {
  constructor(
    private call: <T>(endpoint: string, body: Record<string, unknown>) => Promise<T>
  ) {}

  async create(params: CreateDatabaseParams): Promise<NotionDatabase> {
    return this.call('opentuna-notion-databases', { action: 'create', ...params });
  }

  async get(databaseId: string): Promise<NotionDatabase> {
    return this.call('opentuna-notion-databases', { action: 'get', databaseId });
  }

  async query(databaseId: string, params?: QueryDatabaseParams): Promise<{
    results: NotionPage[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    return this.call('opentuna-notion-databases', { action: 'query', databaseId, ...params });
  }

  async update(databaseId: string, params: {
    title?: string;
    properties?: Record<string, { type: string; options?: { name: string; color?: string }[] }>;
  }): Promise<NotionDatabase> {
    return this.call('opentuna-notion-databases', { action: 'update', databaseId, ...params });
  }

  async list(): Promise<NotionDatabase[]> {
    return this.call('opentuna-notion-databases', { action: 'list' });
  }

  async addProperty(databaseId: string, name: string, type: string, options?: { name: string; color?: string }[]): Promise<NotionDatabase> {
    return this.call('opentuna-notion-databases', { 
      action: 'addProperty', 
      databaseId, 
      name, 
      type, 
      options 
    });
  }

  async removeProperty(databaseId: string, propertyName: string): Promise<NotionDatabase> {
    return this.call('opentuna-notion-databases', { 
      action: 'removeProperty', 
      databaseId, 
      propertyName 
    });
  }
}

class BlocksController {
  constructor(
    private call: <T>(endpoint: string, body: Record<string, unknown>) => Promise<T>
  ) {}

  async get(blockId: string): Promise<NotionBlock> {
    return this.call('opentuna-notion-blocks', { action: 'get', blockId });
  }

  async list(parentId: string, startCursor?: string): Promise<{
    results: NotionBlock[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    return this.call('opentuna-notion-blocks', { action: 'list', blockId: parentId, startCursor });
  }

  async append(parentId: string, blocks: (string | NotionBlock)[]): Promise<NotionBlock[]> {
    return this.call('opentuna-notion-blocks', { action: 'append', blockId: parentId, blocks });
  }

  async update(blockId: string, content: NotionRichText[]): Promise<NotionBlock> {
    return this.call('opentuna-notion-blocks', { action: 'update', blockId, content });
  }

  async delete(blockId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-notion-blocks', { action: 'delete', blockId });
  }

  /**
   * Helper to create a paragraph block
   */
  paragraph(text: string, annotations?: NotionRichText['annotations']): NotionBlock {
    return {
      id: '',
      type: 'paragraph',
      content: [{ type: 'text', text, annotations }],
    };
  }

  /**
   * Helper to create a heading block
   */
  heading(level: 1 | 2 | 3, text: string): NotionBlock {
    return {
      id: '',
      type: `heading_${level}` as NotionBlock['type'],
      content: [{ type: 'text', text }],
    };
  }

  /**
   * Helper to create a bulleted list item
   */
  bulletedListItem(text: string): NotionBlock {
    return {
      id: '',
      type: 'bulleted_list_item',
      content: [{ type: 'text', text }],
    };
  }

  /**
   * Helper to create a numbered list item
   */
  numberedListItem(text: string): NotionBlock {
    return {
      id: '',
      type: 'numbered_list_item',
      content: [{ type: 'text', text }],
    };
  }

  /**
   * Helper to create a to-do item
   */
  toDo(text: string, checked?: boolean): NotionBlock {
    return {
      id: '',
      type: 'to_do',
      content: [{ type: 'text', text }],
      metadata: { checked },
    };
  }

  /**
   * Helper to create a code block
   */
  code(code: string, language?: string): NotionBlock {
    return {
      id: '',
      type: 'code',
      content: [{ type: 'text', text: code }],
      metadata: { language },
    };
  }

  /**
   * Helper to create a quote block
   */
  quote(text: string): NotionBlock {
    return {
      id: '',
      type: 'quote',
      content: [{ type: 'text', text }],
    };
  }

  /**
   * Helper to create a callout block
   */
  callout(text: string, icon?: string): NotionBlock {
    return {
      id: '',
      type: 'callout',
      content: [{ type: 'text', text }],
      metadata: { icon },
    };
  }

  /**
   * Helper to create a divider block
   */
  divider(): NotionBlock {
    return {
      id: '',
      type: 'divider',
      content: [],
    };
  }
}

// ============================================================================
// Notion Controller
// ============================================================================

export class NotionController {
  private baseUrl: string;
  private apiKey: string;
  private agentId?: string;

  public pages: PagesController;
  public databases: DatabasesController;
  public blocks: BlocksController;

  constructor(baseUrl: string, apiKey: string, agentId?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.agentId = agentId;

    const callFn = this.call.bind(this);
    this.pages = new PagesController(callFn);
    this.databases = new DatabasesController(callFn);
    this.blocks = new BlocksController(callFn);
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
   * Connect Notion workspace via OAuth
   */
  async connect(): Promise<{ authUrl: string; state: string }> {
    return this.call('opentuna-notion-connect', {});
  }

  /**
   * Complete OAuth flow
   */
  async completeAuth(code: string, state: string): Promise<{ 
    success: boolean; 
    workspaceName: string;
    workspaceIcon?: string;
  }> {
    return this.call('opentuna-notion-auth', { code, state });
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    workspaceName?: string;
    workspaceIcon?: string;
    botId?: string;
  }> {
    return this.call('opentuna-notion-status', {});
  }

  /**
   * Disconnect Notion workspace
   */
  async disconnect(): Promise<{ success: boolean }> {
    return this.call('opentuna-notion-disconnect', {});
  }

  /**
   * Get all users in workspace
   */
  async listUsers(): Promise<{
    id: string;
    name: string;
    avatarUrl?: string;
    type: 'person' | 'bot';
  }[]> {
    return this.call('opentuna-notion-users', { action: 'list' });
  }

  /**
   * Get current bot user info
   */
  async getBotInfo(): Promise<{
    id: string;
    name: string;
    avatarUrl?: string;
  }> {
    return this.call('opentuna-notion-users', { action: 'me' });
  }

  /**
   * Search across workspace
   */
  async search(query: string, options?: {
    filter?: 'page' | 'database';
    sort?: 'relevance' | 'last_edited_time';
    direction?: 'ascending' | 'descending';
    pageSize?: number;
  }): Promise<(NotionPage | NotionDatabase)[]> {
    return this.call('opentuna-notion-search', { query, ...options });
  }

  /**
   * Create a filter for database queries
   */
  filter = {
    equals: (property: string, value: unknown): NotionFilter => ({
      property,
      equals: value,
    }),
    contains: (property: string, value: string): NotionFilter => ({
      property,
      contains: value,
    }),
    greaterThan: (property: string, value: number | string): NotionFilter => ({
      property,
      greater_than: value,
    }),
    lessThan: (property: string, value: number | string): NotionFilter => ({
      property,
      less_than: value,
    }),
    isEmpty: (property: string): NotionFilter => ({
      property,
      is_empty: true,
    }),
    isNotEmpty: (property: string): NotionFilter => ({
      property,
      is_not_empty: true,
    }),
    after: (property: string, date: string): NotionFilter => ({
      property,
      after: date,
    }),
    before: (property: string, date: string): NotionFilter => ({
      property,
      before: date,
    }),
    and: (...filters: NotionFilter[]): NotionFilter => ({
      and: filters,
    }),
    or: (...filters: NotionFilter[]): NotionFilter => ({
      or: filters,
    }),
  };
}

export default NotionController;

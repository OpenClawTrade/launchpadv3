/**
 * OpenTuna Google Workspace Controller
 * Full Google Docs, Sheets, Drive, and Calendar integration
 * 
 * @example
 * ```typescript
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Create a spreadsheet
 * const sheet = await agent.google.sheets.create('Trading Log', [
 *   ['Date', 'Token', 'Action', 'Amount', 'Result'],
 * ]);
 * 
 * // Append data
 * await agent.google.sheets.append(sheet.id, [
 *   ['2024-01-15', 'BONK', 'BUY', '0.1 SOL', '+25%'],
 * ]);
 * 
 * // Schedule a meeting
 * await agent.google.calendar.schedule({
 *   title: 'Strategy Review',
 *   start: '2024-01-20T10:00:00',
 *   end: '2024-01-20T11:00:00',
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

// --- Google Docs ---
export interface GoogleDoc {
  id: string;
  title: string;
  body: string;
  revisionId: string;
  createdAt: string;
  modifiedAt: string;
}

export interface CreateDocParams {
  title: string;
  content?: string;
  folderId?: string;
}

export interface UpdateDocParams {
  insertText?: { text: string; index: number };
  deleteRange?: { startIndex: number; endIndex: number };
  replaceText?: { search: string; replace: string };
}

// --- Google Sheets ---
export interface GoogleSheet {
  id: string;
  title: string;
  sheets: {
    id: number;
    title: string;
    rowCount: number;
    columnCount: number;
  }[];
  createdAt: string;
  modifiedAt: string;
}

export interface SheetRange {
  range: string; // e.g., 'Sheet1!A1:D10'
  values: (string | number | boolean | null)[][];
}

export interface CreateSheetParams {
  title: string;
  sheets?: string[]; // Sheet names
  initialData?: (string | number | boolean | null)[][];
}

// --- Google Drive ---
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  webViewLink: string;
  downloadLink?: string;
  parents: string[];
  shared: boolean;
}

export interface DriveFolder {
  id: string;
  name: string;
  createdAt: string;
  files: DriveFile[];
  subfolders: DriveFolder[];
}

export interface UploadFileParams {
  name: string;
  content: string; // base64
  mimeType: string;
  folderId?: string;
  description?: string;
}

// --- Google Calendar ---
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: { email: string; responseStatus?: string }[];
  conferenceLink?: string;
  recurrence?: string[];
  reminders?: { method: 'email' | 'popup'; minutes: number }[];
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CreateEventParams {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  addConference?: boolean;
  reminders?: { method: 'email' | 'popup'; minutes: number }[];
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    count?: number;
    until?: string;
    interval?: number;
  };
}

export interface Calendar {
  id: string;
  title: string;
  description?: string;
  timezone: string;
  primary: boolean;
}

// ============================================================================
// Sub-Controllers
// ============================================================================

class DocsController {
  constructor(
    private call: <T>(endpoint: string, body: Record<string, unknown>) => Promise<T>
  ) {}

  async create(params: CreateDocParams | string): Promise<GoogleDoc> {
    const createParams = typeof params === 'string' ? { title: params } : params;
    return this.call('opentuna-google-docs', { action: 'create', ...createParams });
  }

  async get(docId: string): Promise<GoogleDoc> {
    return this.call('opentuna-google-docs', { action: 'get', docId });
  }

  async update(docId: string, params: UpdateDocParams): Promise<GoogleDoc> {
    return this.call('opentuna-google-docs', { action: 'update', docId, ...params });
  }

  async appendText(docId: string, text: string): Promise<GoogleDoc> {
    return this.call('opentuna-google-docs', { action: 'append', docId, text });
  }

  async replace(docId: string, search: string, replace: string): Promise<GoogleDoc> {
    return this.call('opentuna-google-docs', { 
      action: 'update', 
      docId, 
      replaceText: { search, replace } 
    });
  }

  async delete(docId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-google-docs', { action: 'delete', docId });
  }

  async list(folderId?: string): Promise<GoogleDoc[]> {
    return this.call('opentuna-google-docs', { action: 'list', folderId });
  }
}

class SheetsController {
  constructor(
    private call: <T>(endpoint: string, body: Record<string, unknown>) => Promise<T>
  ) {}

  async create(params: CreateSheetParams | string, initialData?: (string | number | boolean | null)[][]): Promise<GoogleSheet> {
    const createParams = typeof params === 'string' 
      ? { title: params, initialData } 
      : params;
    return this.call('opentuna-google-sheets', { action: 'create', ...createParams });
  }

  async get(sheetId: string): Promise<GoogleSheet> {
    return this.call('opentuna-google-sheets', { action: 'get', sheetId });
  }

  async read(sheetId: string, range: string): Promise<SheetRange> {
    return this.call('opentuna-google-sheets', { action: 'read', sheetId, range });
  }

  async write(sheetId: string, range: string, values: (string | number | boolean | null)[][]): Promise<{ updatedCells: number }> {
    return this.call('opentuna-google-sheets', { action: 'write', sheetId, range, values });
  }

  async append(sheetId: string, values: (string | number | boolean | null)[][], sheet?: string): Promise<{ updatedRange: string }> {
    return this.call('opentuna-google-sheets', { action: 'append', sheetId, values, sheet });
  }

  async clear(sheetId: string, range: string): Promise<{ clearedRange: string }> {
    return this.call('opentuna-google-sheets', { action: 'clear', sheetId, range });
  }

  async addSheet(sheetId: string, title: string): Promise<{ sheetId: number }> {
    return this.call('opentuna-google-sheets', { action: 'addSheet', sheetId, title });
  }

  async deleteSheet(sheetId: string, sheetTabId: number): Promise<{ success: boolean }> {
    return this.call('opentuna-google-sheets', { action: 'deleteSheet', sheetId, sheetTabId });
  }

  async delete(sheetId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-google-sheets', { action: 'delete', sheetId });
  }

  async list(folderId?: string): Promise<GoogleSheet[]> {
    return this.call('opentuna-google-sheets', { action: 'list', folderId });
  }
}

class DriveController {
  constructor(
    private call: <T>(endpoint: string, body: Record<string, unknown>) => Promise<T>
  ) {}

  async upload(params: UploadFileParams): Promise<DriveFile> {
    return this.call('opentuna-google-drive', { action: 'upload', ...params });
  }

  async download(fileId: string): Promise<{ content: string; mimeType: string }> {
    return this.call('opentuna-google-drive', { action: 'download', fileId });
  }

  async get(fileId: string): Promise<DriveFile> {
    return this.call('opentuna-google-drive', { action: 'get', fileId });
  }

  async list(folderId?: string): Promise<DriveFile[]> {
    return this.call('opentuna-google-drive', { action: 'list', folderId });
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFolder> {
    return this.call('opentuna-google-drive', { action: 'createFolder', name, parentId });
  }

  async move(fileId: string, newFolderId: string): Promise<DriveFile> {
    return this.call('opentuna-google-drive', { action: 'move', fileId, newFolderId });
  }

  async copy(fileId: string, name?: string, folderId?: string): Promise<DriveFile> {
    return this.call('opentuna-google-drive', { action: 'copy', fileId, name, folderId });
  }

  async rename(fileId: string, name: string): Promise<DriveFile> {
    return this.call('opentuna-google-drive', { action: 'rename', fileId, name });
  }

  async delete(fileId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-google-drive', { action: 'delete', fileId });
  }

  async share(fileId: string, email: string, role: 'reader' | 'writer' | 'commenter'): Promise<{ success: boolean }> {
    return this.call('opentuna-google-drive', { action: 'share', fileId, email, role });
  }

  async search(query: string): Promise<DriveFile[]> {
    return this.call('opentuna-google-drive', { action: 'search', query });
  }

  async getStorageQuota(): Promise<{ used: number; total: number; usedPercent: number }> {
    return this.call('opentuna-google-drive', { action: 'quota' });
  }
}

class CalendarController {
  constructor(
    private call: <T>(endpoint: string, body: Record<string, unknown>) => Promise<T>
  ) {}

  async schedule(params: CreateEventParams): Promise<CalendarEvent> {
    return this.call('opentuna-google-calendar', { action: 'create', ...params });
  }

  async get(eventId: string, calendarId?: string): Promise<CalendarEvent> {
    return this.call('opentuna-google-calendar', { action: 'get', eventId, calendarId });
  }

  async update(eventId: string, params: Partial<CreateEventParams>, calendarId?: string): Promise<CalendarEvent> {
    return this.call('opentuna-google-calendar', { action: 'update', eventId, calendarId, ...params });
  }

  async cancel(eventId: string, calendarId?: string): Promise<{ success: boolean }> {
    return this.call('opentuna-google-calendar', { action: 'cancel', eventId, calendarId });
  }

  async list(options?: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    query?: string;
  }): Promise<CalendarEvent[]> {
    return this.call('opentuna-google-calendar', { action: 'list', ...options });
  }

  async listCalendars(): Promise<Calendar[]> {
    return this.call('opentuna-google-calendar', { action: 'listCalendars' });
  }

  async quickAdd(text: string, calendarId?: string): Promise<CalendarEvent> {
    // Natural language event creation e.g., "Lunch with John tomorrow at noon"
    return this.call('opentuna-google-calendar', { action: 'quickAdd', text, calendarId });
  }

  async freebusy(emails: string[], timeMin: string, timeMax: string): Promise<{
    calendars: Record<string, { busy: { start: string; end: string }[] }>;
  }> {
    return this.call('opentuna-google-calendar', { action: 'freebusy', emails, timeMin, timeMax });
  }

  async findFreeSlots(
    duration: number, // minutes
    attendees: string[],
    options?: {
      startAfter?: string;
      endBefore?: string;
      workingHoursOnly?: boolean;
    }
  ): Promise<{ start: string; end: string }[]> {
    return this.call('opentuna-google-calendar', { 
      action: 'findFreeSlots', 
      duration, 
      attendees, 
      ...options 
    });
  }
}

// ============================================================================
// Google Controller
// ============================================================================

export class GoogleController {
  private baseUrl: string;
  private apiKey: string;
  private agentId?: string;

  public docs: DocsController;
  public sheets: SheetsController;
  public drive: DriveController;
  public calendar: CalendarController;

  constructor(baseUrl: string, apiKey: string, agentId?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.agentId = agentId;

    const callFn = this.call.bind(this);
    this.docs = new DocsController(callFn);
    this.sheets = new SheetsController(callFn);
    this.drive = new DriveController(callFn);
    this.calendar = new CalendarController(callFn);
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
   * Connect Google account via OAuth
   */
  async connect(scopes?: string[]): Promise<{ authUrl: string; state: string }> {
    return this.call('opentuna-google-connect', { scopes });
  }

  /**
   * Complete OAuth flow
   */
  async completeAuth(code: string, state: string): Promise<{ 
    success: boolean; 
    email: string;
    scopes: string[];
  }> {
    return this.call('opentuna-google-auth', { code, state });
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    email?: string;
    scopes?: string[];
    expiresAt?: string;
  }> {
    return this.call('opentuna-google-status', {});
  }

  /**
   * Disconnect Google account
   */
  async disconnect(): Promise<{ success: boolean }> {
    return this.call('opentuna-google-disconnect', {});
  }
}

export default GoogleController;

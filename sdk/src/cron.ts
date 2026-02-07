/**
 * OpenTuna Cron Controller
 * Schedule recurring tasks and manage automated workflows
 * 
 * @example
 * ```typescript
 * const agent = new OpenTuna({ apiKey: 'ota_live_...' });
 * 
 * // Schedule a trading check every 5 minutes
 * await agent.cron.schedule('fin_trade', '*/5 * * * *', { action: 'quote' });
 * 
 * // Schedule daily report at 9am
 * await agent.cron.schedule('fin_email', '0 9 * * *', {
 *   action: 'send',
 *   to: 'user@example.com',
 *   subject: 'Daily Report'
 * });
 * 
 * // List all scheduled jobs
 * const jobs = await agent.cron.list();
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface CronJob {
  id: string;
  agentId: string;
  finId: string;
  cronExpression: string;
  args?: Record<string, unknown>;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  runCount: number;
  lastResult?: CronJobResult;
  createdAt: string;
  updatedAt: string;
}

export interface CronJobResult {
  success: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output?: unknown;
  error?: string;
}

export interface CronJobHistory {
  id: string;
  jobId: string;
  finId: string;
  cronExpression: string;
  args?: Record<string, unknown>;
  result: CronJobResult;
  executedAt: string;
}

export interface ScheduleParams {
  finId: string;
  cronExpression: string;
  args?: Record<string, unknown>;
  enabled?: boolean;
  description?: string;
  timezone?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface UpdateJobParams {
  cronExpression?: string;
  args?: Record<string, unknown>;
  enabled?: boolean;
  description?: string;
  timezone?: string;
  maxRetries?: number;
}

// Common cron presets
export const CronPresets = {
  EVERY_MINUTE: '* * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_2_HOURS: '0 */2 * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  EVERY_12_HOURS: '0 */12 * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  DAILY_9AM: '0 9 * * *',
  DAILY_6PM: '0 18 * * *',
  WEEKLY_MONDAY: '0 0 * * 1',
  WEEKLY_FRIDAY: '0 0 * * 5',
  MONTHLY_FIRST: '0 0 1 * *',
  MONTHLY_LAST: '0 0 L * *',
} as const;

// ============================================================================
// Cron Controller
// ============================================================================

export class CronController {
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
   * Schedule a new cron job
   * 
   * @param finId - The fin to execute (e.g., 'fin_trade', 'fin_email')
   * @param cronExpression - Cron expression (e.g., '*/5 * * * *' for every 5 minutes)
   * @param args - Arguments to pass to the fin
   */
  async schedule(
    finId: string, 
    cronExpression: string, 
    args?: Record<string, unknown>
  ): Promise<CronJob> {
    return this.call('opentuna-cron-schedule', { finId, cronExpression, args });
  }

  /**
   * Schedule with full options
   */
  async scheduleAdvanced(params: ScheduleParams): Promise<CronJob> {
    return this.call('opentuna-cron-schedule', params);
  }

  /**
   * List all scheduled jobs
   */
  async list(includeDisabled?: boolean): Promise<CronJob[]> {
    return this.call('opentuna-cron-list', { includeDisabled });
  }

  /**
   * Get a specific job
   */
  async get(jobId: string): Promise<CronJob> {
    return this.call('opentuna-cron-get', { jobId });
  }

  /**
   * Update a job
   */
  async update(jobId: string, params: UpdateJobParams): Promise<CronJob> {
    return this.call('opentuna-cron-update', { jobId, ...params });
  }

  /**
   * Pause a job
   */
  async pause(jobId: string): Promise<CronJob> {
    return this.call('opentuna-cron-toggle', { jobId, enabled: false });
  }

  /**
   * Resume a paused job
   */
  async resume(jobId: string): Promise<CronJob> {
    return this.call('opentuna-cron-toggle', { jobId, enabled: true });
  }

  /**
   * Remove a job
   */
  async remove(jobId: string): Promise<{ success: boolean }> {
    return this.call('opentuna-cron-remove', { jobId });
  }

  /**
   * Trigger a job immediately (outside of schedule)
   */
  async trigger(jobId: string): Promise<CronJobResult> {
    return this.call('opentuna-cron-trigger', { jobId });
  }

  /**
   * Get job execution history
   */
  async history(jobId: string, limit?: number): Promise<CronJobHistory[]> {
    return this.call('opentuna-cron-history', { jobId, limit: limit || 50 });
  }

  /**
   * Get recent execution history across all jobs
   */
  async recentHistory(limit?: number): Promise<CronJobHistory[]> {
    return this.call('opentuna-cron-history', { all: true, limit: limit || 100 });
  }

  /**
   * Get job statistics
   */
  async stats(): Promise<{
    totalJobs: number;
    activeJobs: number;
    pausedJobs: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    avgDurationMs: number;
  }> {
    return this.call('opentuna-cron-stats', {});
  }

  /**
   * Validate a cron expression
   */
  async validate(cronExpression: string): Promise<{
    valid: boolean;
    error?: string;
    nextRuns: string[]; // Next 5 scheduled times
    description: string; // Human-readable description
  }> {
    return this.call('opentuna-cron-validate', { cronExpression });
  }

  /**
   * Helper to build cron expression
   */
  buildExpression(options: {
    minute?: number | '*' | string;
    hour?: number | '*' | string;
    dayOfMonth?: number | '*' | string;
    month?: number | '*' | string;
    dayOfWeek?: number | '*' | string;
  }): string {
    const {
      minute = '*',
      hour = '*',
      dayOfMonth = '*',
      month = '*',
      dayOfWeek = '*'
    } = options;
    
    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  }

  /**
   * Parse cron expression to human-readable format
   */
  parseExpression(cronExpression: string): {
    minute: string;
    hour: string;
    dayOfMonth: string;
    month: string;
    dayOfWeek: string;
  } {
    const parts = cronExpression.split(' ');
    return {
      minute: parts[0] || '*',
      hour: parts[1] || '*',
      dayOfMonth: parts[2] || '*',
      month: parts[3] || '*',
      dayOfWeek: parts[4] || '*',
    };
  }

  /**
   * Get presets for common schedules
   */
  getPresets(): typeof CronPresets {
    return CronPresets;
  }
}

export { CronPresets };
export default CronController;

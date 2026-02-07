/**
 * OpenTuna CLI - Cron Command
 * Manage scheduled tasks
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { table } from 'table';
import { getApiKey, isConfigured } from '../config';

type CronAction = 'add' | 'list' | 'remove' | 'pause' | 'resume' | 'trigger' | 'history';

interface CronOptions {
  fin?: string;
  schedule?: string;
  args?: string;
  description?: string;
  jobId?: string;
  limit?: string;
  all?: boolean;
}

const CRON_PRESETS = [
  { name: 'Every minute', value: '* * * * *' },
  { name: 'Every 5 minutes', value: '*/5 * * * *' },
  { name: 'Every 15 minutes', value: '*/15 * * * *' },
  { name: 'Every 30 minutes', value: '*/30 * * * *' },
  { name: 'Every hour', value: '0 * * * *' },
  { name: 'Every 6 hours', value: '0 */6 * * *' },
  { name: 'Daily at midnight', value: '0 0 * * *' },
  { name: 'Daily at 9am', value: '0 9 * * *' },
  { name: 'Weekly on Monday', value: '0 0 * * 1' },
  { name: 'Custom', value: 'custom' },
];

const AVAILABLE_FINS = [
  { name: 'fin_trade - Execute trading operations', value: 'fin_trade' },
  { name: 'fin_email - Send/receive emails', value: 'fin_email' },
  { name: 'fin_slack - Post to Slack', value: 'fin_slack' },
  { name: 'fin_discord - Post to Discord', value: 'fin_discord' },
  { name: 'fin_browse - Browse web pages', value: 'fin_browse' },
  { name: 'fin_post - Post to SubTuna', value: 'fin_post' },
];

async function apiCall(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API key not found');

  const response = await fetch(`https://ptwytypavumcrbofspno.supabase.co/functions/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function cronCommand(action: CronAction, options: CronOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.red('\n❌ OpenTuna is not configured.'));
    console.log(chalk.gray('   Run: opentuna init\n'));
    return;
  }

  switch (action) {
    case 'add':
      await addCronJob(options);
      break;
    case 'list':
      await listCronJobs(options);
      break;
    case 'remove':
      await removeCronJob(options.jobId!);
      break;
    case 'pause':
      await toggleCronJob(options.jobId!, false);
      break;
    case 'resume':
      await toggleCronJob(options.jobId!, true);
      break;
    case 'trigger':
      await triggerCronJob(options.jobId!);
      break;
    case 'history':
      await showCronHistory(options.jobId!, parseInt(options.limit || '20'));
      break;
  }
}

async function addCronJob(options: CronOptions): Promise<void> {
  let finId = options.fin;
  let schedule = options.schedule;
  let args = options.args ? JSON.parse(options.args) : undefined;

  // Interactive selection if not provided
  if (!finId) {
    const { fin } = await inquirer.prompt([{
      type: 'list',
      name: 'fin',
      message: 'Which fin should run on schedule?',
      choices: AVAILABLE_FINS,
    }]);
    finId = fin;
  }

  if (!schedule) {
    const { preset } = await inquirer.prompt([{
      type: 'list',
      name: 'preset',
      message: 'How often should it run?',
      choices: CRON_PRESETS,
    }]);

    if (preset === 'custom') {
      const { custom } = await inquirer.prompt([{
        type: 'input',
        name: 'custom',
        message: 'Enter cron expression (e.g., */5 * * * *):',
        validate: (input) => {
          const parts = input.trim().split(' ');
          if (parts.length !== 5) return 'Invalid cron expression (need 5 parts)';
          return true;
        },
      }]);
      schedule = custom;
    } else {
      schedule = preset;
    }
  }

  // Get args if not provided
  if (!args && finId) {
    const { needsArgs } = await inquirer.prompt([{
      type: 'confirm',
      name: 'needsArgs',
      message: 'Do you want to pass arguments to this fin?',
      default: false,
    }]);

    if (needsArgs) {
      const { argsJson } = await inquirer.prompt([{
        type: 'input',
        name: 'argsJson',
        message: 'Enter arguments as JSON:',
        default: '{}',
        validate: (input) => {
          try {
            JSON.parse(input);
            return true;
          } catch {
            return 'Invalid JSON';
          }
        },
      }]);
      args = JSON.parse(argsJson);
    }
  }

  const spinner = ora('Creating cron job...').start();

  try {
    const result = await apiCall('opentuna-cron-schedule', {
      finId,
      cronExpression: schedule,
      args,
      description: options.description,
    }) as { id: string; nextRunAt: string };

    spinner.succeed('Cron job created!');
    console.log(chalk.gray(`\n   Job ID: ${result.id}`));
    console.log(chalk.gray(`   Next run: ${new Date(result.nextRunAt).toLocaleString()}\n`));
  } catch (error) {
    spinner.fail('Failed to create cron job');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function listCronJobs(options: CronOptions): Promise<void> {
  const spinner = ora('Fetching cron jobs...').start();

  try {
    const jobs = await apiCall('opentuna-cron-list', {
      includeDisabled: options.all,
    }) as Array<{
      id: string;
      finId: string;
      cronExpression: string;
      enabled: boolean;
      nextRunAt: string;
      runCount: number;
    }>;

    spinner.stop();

    if (jobs.length === 0) {
      console.log(chalk.yellow('\n   No cron jobs found.\n'));
      console.log(chalk.gray('   Create one with: opentuna cron add\n'));
      return;
    }

    const data = [
      [chalk.bold('ID'), chalk.bold('Fin'), chalk.bold('Schedule'), chalk.bold('Status'), chalk.bold('Next Run'), chalk.bold('Runs')],
      ...jobs.map((job) => [
        job.id.slice(0, 8),
        job.finId,
        job.cronExpression,
        job.enabled ? chalk.green('Active') : chalk.yellow('Paused'),
        job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '-',
        job.runCount.toString(),
      ]),
    ];

    console.log('\n' + table(data, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼',
      },
    }));
  } catch (error) {
    spinner.fail('Failed to fetch cron jobs');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function removeCronJob(jobId: string): Promise<void> {
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Are you sure you want to remove job ${jobId}?`,
    default: false,
  }]);

  if (!confirm) {
    console.log(chalk.yellow('\n   Cancelled.\n'));
    return;
  }

  const spinner = ora('Removing cron job...').start();

  try {
    await apiCall('opentuna-cron-remove', { jobId });
    spinner.succeed('Cron job removed!');
  } catch (error) {
    spinner.fail('Failed to remove cron job');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function toggleCronJob(jobId: string, enabled: boolean): Promise<void> {
  const spinner = ora(enabled ? 'Resuming job...' : 'Pausing job...').start();

  try {
    await apiCall('opentuna-cron-toggle', { jobId, enabled });
    spinner.succeed(enabled ? 'Job resumed!' : 'Job paused!');
  } catch (error) {
    spinner.fail('Failed to update job');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function triggerCronJob(jobId: string): Promise<void> {
  const spinner = ora('Triggering job...').start();

  try {
    const result = await apiCall('opentuna-cron-trigger', { jobId }) as {
      success: boolean;
      durationMs: number;
    };
    
    if (result.success) {
      spinner.succeed(`Job completed in ${result.durationMs}ms`);
    } else {
      spinner.warn('Job completed with errors');
    }
  } catch (error) {
    spinner.fail('Failed to trigger job');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function showCronHistory(jobId: string, limit: number): Promise<void> {
  const spinner = ora('Fetching history...').start();

  try {
    const history = await apiCall('opentuna-cron-history', { jobId, limit }) as Array<{
      id: string;
      executedAt: string;
      result: {
        success: boolean;
        durationMs: number;
        error?: string;
      };
    }>;

    spinner.stop();

    if (history.length === 0) {
      console.log(chalk.yellow('\n   No execution history found.\n'));
      return;
    }

    const data = [
      [chalk.bold('Time'), chalk.bold('Status'), chalk.bold('Duration'), chalk.bold('Error')],
      ...history.map((entry) => [
        new Date(entry.executedAt).toLocaleString(),
        entry.result.success ? chalk.green('Success') : chalk.red('Failed'),
        `${entry.result.durationMs}ms`,
        entry.result.error?.slice(0, 30) || '-',
      ]),
    ];

    console.log('\n' + table(data));
  } catch (error) {
    spinner.fail('Failed to fetch history');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

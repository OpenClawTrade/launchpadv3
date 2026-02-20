/**
 * Claw CLI - Sonar Command
 * Control agent activity mode
 */

import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { getApiKey, isConfigured, setConfigValue, getConfigValue } from '../config';

type SonarAction = 'set' | 'status' | 'pause' | 'resume' | 'ping';

interface SonarOptions {
  mode?: string;
}

const SONAR_MODES = {
  drift: {
    name: 'Drift',
    icon: '😴',
    description: 'Minimal activity - only responds when directly triggered',
    activityLevel: 1,
    color: 'gray',
  },
  cruise: {
    name: 'Cruise',
    icon: '🚢',
    description: 'Normal operation - balanced autonomous activity',
    activityLevel: 2,
    color: 'blue',
  },
  hunt: {
    name: 'Hunt',
    icon: '🎯',
    description: 'Active seeking - frequent scans for opportunities',
    activityLevel: 3,
    color: 'yellow',
  },
  frenzy: {
    name: 'Frenzy',
    icon: '🔥',
    description: 'Maximum activity - aggressive pursuit of goals',
    activityLevel: 4,
    color: 'red',
  },
};

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

export async function sonarCommand(action: SonarAction, options: SonarOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.red('\n❌ Claw is not configured.'));
    console.log(chalk.gray('   Run: claw init\n'));
    return;
  }

  switch (action) {
    case 'set':
      await setMode(options.mode!);
      break;
    case 'status':
      await showStatus();
      break;
    case 'pause':
      await pauseSonar();
      break;
    case 'resume':
      await resumeSonar();
      break;
    case 'ping':
      await pingSonar();
      break;
  }
}

async function setMode(mode: string): Promise<void> {
  const validModes = Object.keys(SONAR_MODES);
  
  if (!validModes.includes(mode)) {
    console.log(chalk.red(`\n❌ Invalid mode: ${mode}`));
    console.log(chalk.gray(`   Valid modes: ${validModes.join(', ')}\n`));
    return;
  }

  const modeInfo = SONAR_MODES[mode as keyof typeof SONAR_MODES];
  const spinner = ora(`Setting sonar to ${modeInfo.name}...`).start();

  try {
    await apiCall('opentuna-sonar-set', { mode });
    setConfigValue('sonarMode', mode as any);
    
    spinner.succeed(`Sonar set to ${modeInfo.icon} ${modeInfo.name}`);
    console.log(chalk.gray(`\n   ${modeInfo.description}\n`));
  } catch (error) {
    spinner.fail('Failed to set sonar mode');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function showStatus(): Promise<void> {
  const spinner = ora('Checking sonar status...').start();

  try {
    const result = await apiCall('opentuna-sonar-status', {}) as {
      mode: keyof typeof SONAR_MODES;
      paused: boolean;
      lastPing: string;
      nextScheduledPing: string;
      decisionsToday: number;
      actionsToday: number;
      health: 'healthy' | 'degraded' | 'offline';
    };

    spinner.stop();

    const modeInfo = SONAR_MODES[result.mode] || SONAR_MODES.cruise;
    const healthColor = result.health === 'healthy' ? 'green' : result.health === 'degraded' ? 'yellow' : 'red';
    const healthIcon = result.health === 'healthy' ? '✓' : result.health === 'degraded' ? '⚠' : '✗';

    const activityBar = '█'.repeat(modeInfo.activityLevel) + '░'.repeat(4 - modeInfo.activityLevel);

    console.log(boxen(
      chalk.cyan('📡 Sonar Status\n\n') +
      chalk.white(`Mode: ${modeInfo.icon} ${modeInfo.name}\n`) +
      chalk.gray(`      ${modeInfo.description}\n\n`) +
      chalk.white(`Activity Level: [${activityBar}]\n\n`) +
      chalk.white(`Status:    `) + (result.paused ? chalk.yellow('⏸ Paused') : chalk.green('▶ Active')) + '\n' +
      chalk.white(`Health:    `) + chalk[healthColor](`${healthIcon} ${result.health}`) + '\n' +
      chalk.white(`Last Ping: `) + chalk.gray(result.lastPing ? new Date(result.lastPing).toLocaleString() : 'Never') + '\n' +
      chalk.white(`Next Ping: `) + chalk.gray(result.nextScheduledPing ? new Date(result.nextScheduledPing).toLocaleString() : 'Not scheduled') + '\n\n' +
      chalk.gray(`Today: ${result.decisionsToday} decisions, ${result.actionsToday} actions`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }
    ));

    console.log(chalk.gray('  Available modes:'));
    for (const [key, info] of Object.entries(SONAR_MODES)) {
      const isCurrent = key === result.mode;
      const prefix = isCurrent ? chalk.cyan('→') : chalk.gray(' ');
      console.log(`  ${prefix} ${info.icon} ${info.name} - ${info.description}`);
    }
    console.log();
  } catch (error) {
    spinner.fail('Failed to get sonar status');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function pauseSonar(): Promise<void> {
  const spinner = ora('Pausing sonar...').start();

  try {
    await apiCall('opentuna-sonar-pause', {});
    spinner.succeed('Sonar paused');
    console.log(chalk.gray('\n   Agent will not take autonomous actions until resumed.\n'));
    console.log(chalk.gray('   Resume with: claw sonar resume\n'));
  } catch (error) {
    spinner.fail('Failed to pause sonar');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function resumeSonar(): Promise<void> {
  const spinner = ora('Resuming sonar...').start();

  try {
    await apiCall('opentuna-sonar-resume', {});
    spinner.succeed('Sonar resumed');
    
    const mode = getConfigValue('sonarMode') || 'cruise';
    const modeInfo = SONAR_MODES[mode];
    console.log(chalk.gray(`\n   Agent is now active in ${modeInfo.icon} ${modeInfo.name} mode.\n`));
  } catch (error) {
    spinner.fail('Failed to resume sonar');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function pingSonar(): Promise<void> {
  const spinner = ora('Triggering sonar cycle...').start();

  try {
    const result = await apiCall('opentuna-sonar-ping', {}) as {
      shouldAct: boolean;
      action?: string;
      reasoning: string;
      confidence: number;
    };

    spinner.succeed('Sonar cycle complete');

    console.log(chalk.gray('\n   Decision:'));
    console.log(chalk.white(`   Should act: ${result.shouldAct ? chalk.green('Yes') : chalk.yellow('No')}`));
    if (result.action) {
      console.log(chalk.white(`   Action: ${result.action}`));
    }
    console.log(chalk.white(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`));
    console.log(chalk.gray(`   Reasoning: ${result.reasoning.slice(0, 100)}${result.reasoning.length > 100 ? '...' : ''}\n`));
  } catch (error) {
    spinner.fail('Failed to ping sonar');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

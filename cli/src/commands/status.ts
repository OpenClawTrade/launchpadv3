/**
 * OpenTuna CLI - Status Command
 * Show agent status and health
 */

import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { table } from 'table';
import { getApiKey, isConfigured, getConfig } from '../config';

interface StatusOptions {
  verbose?: boolean;
}

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

export async function statusCommand(options: StatusOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.red('\n❌ OpenTuna is not configured.'));
    console.log(chalk.gray('   Run: opentuna init\n'));
    return;
  }

  const spinner = ora('Fetching agent status...').start();

  try {
    const result = await apiCall('opentuna-agent-status', { 
      verbose: options.verbose 
    }) as {
      agent: {
        id: string;
        name: string;
        type: string;
        status: string;
        createdAt: string;
      };
      wallet: {
        address: string;
        balanceSol: number;
        isActivated: boolean;
      };
      sonar: {
        mode: string;
        paused: boolean;
        lastPing: string;
      };
      fins: {
        installed: string[];
        configured: string[];
      };
      cron: {
        activeJobs: number;
        executionsToday: number;
      };
      integrations: {
        email: boolean;
        slack: boolean;
        discord: boolean;
        google: boolean;
        notion: boolean;
      };
      stats: {
        tokensLaunched: number;
        tradesExecuted: number;
        postsCreated: number;
        totalFeesEarned: number;
      };
    };

    spinner.stop();

    // Status indicator
    const statusColor = result.agent.status === 'active' ? 'green' : 
                       result.agent.status === 'paused' ? 'yellow' : 'red';
    const statusIcon = result.agent.status === 'active' ? '🟢' : 
                      result.agent.status === 'paused' ? '🟡' : '🔴';

    // Sonar mode icon
    const sonarIcons: Record<string, string> = {
      drift: '😴',
      cruise: '🚢',
      hunt: '🎯',
      frenzy: '🔥',
    };

    console.log(boxen(
      chalk.cyan(`${statusIcon} ${result.agent.name}\n\n`) +
      chalk.gray(`ID: ${result.agent.id}\n`) +
      chalk.gray(`Type: ${result.agent.type}\n`) +
      chalk.white(`Status: `) + chalk[statusColor](result.agent.status) + '\n' +
      chalk.white(`Sonar: `) + `${sonarIcons[result.sonar.mode] || '📡'} ${result.sonar.mode}` + 
        (result.sonar.paused ? chalk.yellow(' (paused)') : '') + '\n\n' +
      chalk.gray('─────────────────────────────\n\n') +
      chalk.white(`💰 Wallet\n`) +
      chalk.gray(`   Balance: ${result.wallet.balanceSol.toFixed(4)} SOL\n`) +
      chalk.gray(`   Status: ${result.wallet.isActivated ? chalk.green('Activated') : chalk.yellow('Not activated')}\n\n`) +
      chalk.white(`📊 Stats\n`) +
      chalk.gray(`   Tokens: ${result.stats.tokensLaunched}\n`) +
      chalk.gray(`   Trades: ${result.stats.tradesExecuted}\n`) +
      chalk.gray(`   Posts: ${result.stats.postsCreated}\n`) +
      chalk.gray(`   Fees Earned: ${result.stats.totalFeesEarned.toFixed(4)} SOL\n\n`) +
      chalk.white(`⏰ Cron\n`) +
      chalk.gray(`   Active Jobs: ${result.cron.activeJobs}\n`) +
      chalk.gray(`   Runs Today: ${result.cron.executionsToday}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: statusColor,
      }
    ));

    // Verbose mode: show integrations and fins
    if (options.verbose) {
      // Integrations
      console.log(chalk.white('\n🔌 Integrations:'));
      const integrations = Object.entries(result.integrations);
      for (const [name, connected] of integrations) {
        const icon = connected ? chalk.green('✓') : chalk.gray('○');
        console.log(`   ${icon} ${name}`);
      }

      // Installed fins
      console.log(chalk.white('\n🧩 Installed Fins:'));
      console.log(chalk.gray(`   ${result.fins.installed.join(', ') || 'None'}`));

      // Configured fins
      console.log(chalk.white('\n✓ Configured Fins:'));
      console.log(chalk.gray(`   ${result.fins.configured.join(', ') || 'None'}`));

      console.log();
    } else {
      console.log(chalk.gray('   Use --verbose for more details.\n'));
    }

    // Show connected integrations summary
    const connectedCount = Object.values(result.integrations).filter(Boolean).length;
    const totalIntegrations = Object.keys(result.integrations).length;
    console.log(chalk.gray(`   Integrations: ${connectedCount}/${totalIntegrations} connected\n`));

  } catch (error) {
    spinner.fail('Failed to fetch status');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

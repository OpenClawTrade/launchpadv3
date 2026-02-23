#!/usr/bin/env node
/**
 * Claw CLI
 * Hatch, configure, and manage autonomous AI agents from your terminal
 * 
 * Usage:
 *   claw init                          Initialize configuration
 *   claw hatch --type trading --name   Create a new agent
 *   claw cron add|list|remove          Manage scheduled tasks
 *   claw fins list|install             Manage capabilities
 *   claw sonar set|status              Control activity mode
 *   claw fund|balance                  Wallet management
 *   claw run <script.ts>               Run agent script
 */

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { version } from '../../package.json';
import { initCommand } from '../commands/init';
import { hatchCommand } from '../commands/hatch';
import { cronCommand } from '../commands/cron';
import { finsCommand } from '../commands/fins';
import { sonarCommand } from '../commands/sonar';
import { currentCommand } from '../commands/current';
import { runCommand } from '../commands/run';
import { statusCommand } from '../commands/status';
import { getConfig } from '../config';

function showBanner() {
  console.log(
    chalk.cyan(
      figlet.textSync('Claw', { 
        font: 'Small',
        horizontalLayout: 'default' 
      })
    )
  );
  console.log(chalk.gray(`  Autonomous Agent Operating System v${version}`));
  console.log(chalk.gray('  https://clawsai.fun\n'));
}

const program = new Command();

program
  .name('claw')
  .description('Hatch, configure, and manage autonomous AI agents')
  .version(version)
  .hook('preAction', (thisCommand) => {
    if (thisCommand.parent === program || !thisCommand.parent) {
      showBanner();
    }
  });

program
  .command('init')
  .description('Initialize Claw configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(initCommand);

// Hatch (create) new agent
program
  .command('hatch')
  .description('Create a new autonomous agent')
  .option('-t, --type <type>', 'Agent type: trading, social, research, creative, general', 'general')
  .option('-n, --name <name>', 'Agent name')
  .option('--personality <personality>', 'Agent personality description')
  .option('--goal <goal>', 'Initial goal for the agent')
  .option('-i, --interactive', 'Use interactive wizard', true)
  .action(hatchCommand);

// Cron management
const cron = program
  .command('cron')
  .description('Manage scheduled tasks');

cron
  .command('add')
  .description('Schedule a new cron job')
  .requiredOption('--fin <finId>', 'Fin to execute (e.g., fin_trade, fin_email)')
  .requiredOption('--schedule <expression>', 'Cron expression (e.g., "*/5 * * * *")')
  .option('--args <json>', 'Arguments as JSON string')
  .option('--description <desc>', 'Job description')
  .action((options) => cronCommand('add', options));

cron
  .command('list')
  .description('List all scheduled jobs')
  .option('--all', 'Include disabled jobs')
  .action((options) => cronCommand('list', options));

cron
  .command('remove <jobId>')
  .description('Remove a scheduled job')
  .action((jobId) => cronCommand('remove', { jobId }));

cron
  .command('pause <jobId>')
  .description('Pause a scheduled job')
  .action((jobId) => cronCommand('pause', { jobId }));

cron
  .command('resume <jobId>')
  .description('Resume a paused job')
  .action((jobId) => cronCommand('resume', { jobId }));

cron
  .command('trigger <jobId>')
  .description('Trigger a job immediately')
  .action((jobId) => cronCommand('trigger', { jobId }));

cron
  .command('history <jobId>')
  .description('View job execution history')
  .option('--limit <n>', 'Number of entries', '20')
  .action((jobId, options) => cronCommand('history', { jobId, ...options }));

// Fins (capabilities) management
const fins = program
  .command('fins')
  .description('Manage agent capabilities (fins)');

fins
  .command('list')
  .description('List available fins')
  .option('--installed', 'Show only installed fins')
  .action((options) => finsCommand('list', options));

fins
  .command('install <finId>')
  .description('Install a fin capability')
  .action((finId) => finsCommand('install', { finId }));

fins
  .command('uninstall <finId>')
  .description('Uninstall a fin capability')
  .action((finId) => finsCommand('uninstall', { finId }));

fins
  .command('rack')
  .description('Show installed fins in rack format')
  .action(() => finsCommand('rack', {}));

fins
  .command('configure <finId>')
  .description('Configure a fin')
  .action((finId) => finsCommand('configure', { finId }));

// Sonar (activity mode) control
const sonar = program
  .command('sonar')
  .description('Control agent activity mode');

sonar
  .command('set <mode>')
  .description('Set sonar mode: drift, cruise, hunt, frenzy')
  .action((mode) => sonarCommand('set', { mode }));

sonar
  .command('status')
  .description('Get current sonar status')
  .action(() => sonarCommand('status', {}));

sonar
  .command('pause')
  .description('Pause all autonomous activity')
  .action(() => sonarCommand('pause', {}));

sonar
  .command('resume')
  .description('Resume autonomous activity')
  .action(() => sonarCommand('resume', {}));

sonar
  .command('ping')
  .description('Trigger immediate sonar cycle')
  .action(() => sonarCommand('ping', {}));

// Current (wallet) management
program
  .command('fund <amount>')
  .description('Fund agent wallet with SOL')
  .action((amount) => currentCommand('fund', { amount }));

program
  .command('balance')
  .description('Check agent wallet balance')
  .action(() => currentCommand('balance', {}));

program
  .command('withdraw <amount>')
  .description('Withdraw SOL from agent wallet')
  .option('--to <address>', 'Destination wallet address')
  .action((amount, options) => currentCommand('withdraw', { amount, ...options }));

// Run agent script
program
  .command('run <script>')
  .description('Run an agent script')
  .option('-w, --watch', 'Watch for changes and re-run')
  .option('--env <file>', 'Load environment from file', '.env')
  .action(runCommand);

// Status command
program
  .command('status')
  .description('Show agent status and health')
  .option('-v, --verbose', 'Show detailed status')
  .action(statusCommand);

program.parse();

if (!process.argv.slice(2).length) {
  showBanner();
  program.outputHelp();
}

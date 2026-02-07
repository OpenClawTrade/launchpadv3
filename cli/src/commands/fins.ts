/**
 * OpenTuna CLI - Fins Command
 * Manage agent capabilities
 */

import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { table } from 'table';
import { getApiKey, isConfigured } from '../config';

type FinsAction = 'list' | 'install' | 'uninstall' | 'rack' | 'configure';

interface FinsOptions {
  finId?: string;
  installed?: boolean;
}

// Core fins that are always available
const CORE_FINS = [
  {
    id: 'fin_read',
    name: 'Read',
    icon: '📖',
    description: 'Read file contents from agent sandbox',
    category: 'File System',
    installed: true,
    core: true,
  },
  {
    id: 'fin_write',
    name: 'Write',
    icon: '✏️',
    description: 'Write content to files in agent sandbox',
    category: 'File System',
    installed: true,
    core: true,
  },
  {
    id: 'fin_edit',
    name: 'Edit',
    icon: '🔧',
    description: 'Edit files using search/replace patterns',
    category: 'File System',
    installed: true,
    core: true,
  },
  {
    id: 'fin_bash',
    name: 'Bash',
    icon: '💻',
    description: 'Execute shell commands (40+ approved commands)',
    category: 'Shell',
    installed: true,
    core: true,
  },
  {
    id: 'fin_browse',
    name: 'Browse',
    icon: '🌐',
    description: 'Browser automation - navigate, click, extract',
    category: 'Browser',
    installed: true,
    core: true,
  },
  {
    id: 'fin_trade',
    name: 'Trade',
    icon: '📈',
    description: 'Execute token trades via Jupiter V6 + Jito',
    category: 'Trading',
    installed: true,
    core: true,
  },
];

// Additional fins that can be installed
const INSTALLABLE_FINS = [
  {
    id: 'fin_email',
    name: 'Email',
    icon: '📧',
    description: 'Gmail/Outlook inbox management and sending',
    category: 'Communication',
    installed: false,
    core: false,
    requiresAuth: 'OAuth',
  },
  {
    id: 'fin_slack',
    name: 'Slack',
    icon: '💬',
    description: 'Slack messaging and channel management',
    category: 'Communication',
    installed: false,
    core: false,
    requiresAuth: 'OAuth',
  },
  {
    id: 'fin_discord',
    name: 'Discord',
    icon: '🎮',
    description: 'Discord bot messaging and server management',
    category: 'Communication',
    installed: false,
    core: false,
    requiresAuth: 'Bot Token',
  },
  {
    id: 'fin_whatsapp',
    name: 'WhatsApp',
    icon: '📱',
    description: 'WhatsApp Business API messaging',
    category: 'Communication',
    installed: false,
    core: false,
    requiresAuth: 'Meta Business API',
  },
  {
    id: 'fin_google',
    name: 'Google Workspace',
    icon: '📊',
    description: 'Docs, Sheets, Drive, Calendar integration',
    category: 'Productivity',
    installed: false,
    core: false,
    requiresAuth: 'OAuth',
  },
  {
    id: 'fin_notion',
    name: 'Notion',
    icon: '📝',
    description: 'Notion pages and database management',
    category: 'Productivity',
    installed: false,
    core: false,
    requiresAuth: 'OAuth',
  },
  {
    id: 'fin_mcp',
    name: 'MCP',
    icon: '🔌',
    description: 'Connect to 700+ MCP community tools',
    category: 'Protocol',
    installed: false,
    core: false,
    requiresAuth: 'Server-specific',
  },
  {
    id: 'fin_post',
    name: 'Social Post',
    icon: '📢',
    description: 'Post to SubTuna and social platforms',
    category: 'Social',
    installed: false,
    core: false,
    requiresAuth: 'API Key',
  },
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

export async function finsCommand(action: FinsAction, options: FinsOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.red('\n❌ OpenTuna is not configured.'));
    console.log(chalk.gray('   Run: opentuna init\n'));
    return;
  }

  switch (action) {
    case 'list':
      await listFins(options.installed);
      break;
    case 'install':
      await installFin(options.finId!);
      break;
    case 'uninstall':
      await uninstallFin(options.finId!);
      break;
    case 'rack':
      await showRack();
      break;
    case 'configure':
      await configureFin(options.finId!);
      break;
  }
}

async function listFins(installedOnly?: boolean): Promise<void> {
  const spinner = ora('Loading fins...').start();

  try {
    // Get installed fins from API
    const result = await apiCall('opentuna-fins-list', {}) as {
      installed: string[];
    };

    spinner.stop();

    const allFins = [...CORE_FINS, ...INSTALLABLE_FINS].map(fin => ({
      ...fin,
      installed: fin.core || result.installed.includes(fin.id),
    }));

    const finsToShow = installedOnly 
      ? allFins.filter(f => f.installed)
      : allFins;

    // Group by category
    const categories = [...new Set(finsToShow.map(f => f.category))];

    console.log(chalk.cyan('\n🧩 Available Fins\n'));

    for (const category of categories) {
      const categoryFins = finsToShow.filter(f => f.category === category);
      console.log(chalk.white(`  ${category}:`));
      
      for (const fin of categoryFins) {
        const status = fin.installed 
          ? chalk.green('✓') 
          : chalk.gray('○');
        const core = fin.core ? chalk.gray(' (core)') : '';
        console.log(`    ${status} ${fin.icon} ${chalk.white(fin.id)}${core}`);
        console.log(chalk.gray(`       ${fin.description}`));
      }
      console.log();
    }

    console.log(chalk.gray('  Install a fin: opentuna fins install <fin_id>'));
    console.log(chalk.gray('  Show rack view: opentuna fins rack\n'));
  } catch (error) {
    spinner.fail('Failed to load fins');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function installFin(finId: string): Promise<void> {
  const fin = INSTALLABLE_FINS.find(f => f.id === finId);
  
  if (!fin) {
    console.log(chalk.red(`\n❌ Unknown fin: ${finId}`));
    console.log(chalk.gray('   Run: opentuna fins list\n'));
    return;
  }

  const spinner = ora(`Installing ${fin.name}...`).start();

  try {
    await apiCall('opentuna-fins-install', { finId });
    spinner.succeed(`${fin.icon} ${fin.name} installed!`);

    if (fin.requiresAuth) {
      console.log(chalk.yellow(`\n⚠️  This fin requires authentication: ${fin.requiresAuth}`));
      console.log(chalk.gray(`   Run: opentuna fins configure ${finId}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to install fin');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function uninstallFin(finId: string): Promise<void> {
  const fin = [...CORE_FINS, ...INSTALLABLE_FINS].find(f => f.id === finId);
  
  if (!fin) {
    console.log(chalk.red(`\n❌ Unknown fin: ${finId}`));
    return;
  }

  if (fin.core) {
    console.log(chalk.red(`\n❌ Cannot uninstall core fin: ${finId}`));
    console.log(chalk.gray('   Core fins are required for agent operation.\n'));
    return;
  }

  const spinner = ora(`Uninstalling ${fin.name}...`).start();

  try {
    await apiCall('opentuna-fins-uninstall', { finId });
    spinner.succeed(`${fin.name} uninstalled.`);
  } catch (error) {
    spinner.fail('Failed to uninstall fin');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function showRack(): Promise<void> {
  const spinner = ora('Loading fin rack...').start();

  try {
    const result = await apiCall('opentuna-fins-list', {}) as {
      installed: string[];
    };

    spinner.stop();

    const allFins = [...CORE_FINS, ...INSTALLABLE_FINS];
    const installedFins = allFins.filter(f => f.core || result.installed.includes(f.id));

    const rackDisplay = installedFins.map(f => `${f.icon} ${f.id}`).join('  ');

    console.log(boxen(
      chalk.cyan('🎛️  Fin Rack\n\n') +
      chalk.white('Installed capabilities:\n\n') +
      rackDisplay + '\n\n' +
      chalk.gray(`${installedFins.length} fins active`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }
    ));
  } catch (error) {
    spinner.fail('Failed to load rack');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function configureFin(finId: string): Promise<void> {
  const fin = INSTALLABLE_FINS.find(f => f.id === finId);
  
  if (!fin) {
    console.log(chalk.red(`\n❌ Unknown fin: ${finId}`));
    return;
  }

  console.log(chalk.cyan(`\n🔧 Configure ${fin.icon} ${fin.name}\n`));
  console.log(chalk.gray(`   Authentication: ${fin.requiresAuth}\n`));

  // OAuth-based fins
  if (fin.requiresAuth === 'OAuth') {
    const spinner = ora('Getting authorization URL...').start();
    
    try {
      const result = await apiCall(`opentuna-${finId.replace('fin_', '')}-connect`, {}) as {
        authUrl: string;
      };
      
      spinner.stop();
      
      console.log(chalk.white('   Open this URL to authorize:\n'));
      console.log(chalk.cyan(`   ${result.authUrl}\n`));
      console.log(chalk.gray('   After authorizing, the fin will be ready to use.\n'));
    } catch (error) {
      spinner.fail('Failed to get authorization URL');
      console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
    }
    return;
  }

  // Token-based fins
  console.log(chalk.yellow('   Configuration for this fin type is not yet implemented.\n'));
  console.log(chalk.gray('   Please configure via the web interface at https://tuna.fun/opentuna\n'));
}

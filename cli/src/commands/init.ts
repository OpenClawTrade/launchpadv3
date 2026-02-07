/**
 * OpenTuna CLI - Init Command
 * Initialize OpenTuna configuration
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import boxen from 'boxen';
import { 
  setApiKey, 
  setAgentId, 
  getConfig, 
  resetConfig, 
  isConfigured,
  getConfigPath 
} from '../config';

interface InitOptions {
  force?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  // Check if already configured
  if (isConfigured() && !options.force) {
    console.log(chalk.yellow('\n⚠️  OpenTuna is already configured.'));
    console.log(chalk.gray(`   Config file: ${getConfigPath()}`));
    
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'Do you want to overwrite the existing configuration?',
      default: false,
    }]);

    if (!overwrite) {
      console.log(chalk.gray('\n   Use --force to skip this prompt.\n'));
      return;
    }
  }

  console.log(chalk.cyan('\n🐟 Welcome to OpenTuna Setup\n'));

  // Get API key
  const { hasApiKey } = await inquirer.prompt([{
    type: 'confirm',
    name: 'hasApiKey',
    message: 'Do you already have an OpenTuna API key?',
    default: false,
  }]);

  let apiKey: string;

  if (hasApiKey) {
    const { key } = await inquirer.prompt([{
      type: 'password',
      name: 'key',
      message: 'Enter your API key:',
      mask: '*',
      validate: (input) => {
        if (!input) return 'API key is required';
        if (!input.startsWith('ota_')) return 'Invalid API key format (should start with ota_)';
        return true;
      },
    }]);
    apiKey = key;
  } else {
    console.log(chalk.gray('\n   To get an API key, you need to register an agent.\n'));
    
    const { name, walletAddress } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Agent name:',
        validate: (input) => input.length >= 2 || 'Name must be at least 2 characters',
      },
      {
        type: 'input',
        name: 'walletAddress',
        message: 'Your Solana wallet address (for fee payouts):',
        validate: (input) => {
          if (!input) return 'Wallet address is required';
          if (input.length < 32) return 'Invalid wallet address';
          return true;
        },
      },
    ]);

    const spinner = ora('Registering agent...').start();

    try {
      const response = await fetch('https://tuna.fun/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, walletAddress }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Registration failed');
      }

      const result = await response.json();
      apiKey = result.apiKey;
      
      spinner.succeed('Agent registered successfully!');
      
      console.log(boxen(
        chalk.green('🔑 Your API Key:\n\n') + 
        chalk.yellow(apiKey) + 
        chalk.gray('\n\n⚠️  Save this key! It will not be shown again.'),
        { 
          padding: 1, 
          margin: 1, 
          borderStyle: 'round',
          borderColor: 'green',
        }
      ));

      setAgentId(result.agentId);
    } catch (error) {
      spinner.fail('Registration failed');
      console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
      return;
    }
  }

  // Save API key
  setApiKey(apiKey);

  // Verify API key
  const spinner = ora('Verifying API key...').start();

  try {
    const response = await fetch('https://ptwytypavumcrbofspno.supabase.co/functions/v1/opentuna-agent-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    const agentInfo = await response.json();
    spinner.succeed('API key verified!');

    console.log(chalk.gray(`\n   Agent: ${agentInfo.name}`));
    console.log(chalk.gray(`   ID: ${agentInfo.id}`));
    console.log(chalk.gray(`   Status: ${agentInfo.status}\n`));

    if (agentInfo.id) {
      setAgentId(agentInfo.id);
    }
  } catch (error) {
    spinner.warn('Could not verify API key (will be checked on first use)');
  }

  // Additional configuration
  const { agentType, timezone } = await inquirer.prompt([
    {
      type: 'list',
      name: 'agentType',
      message: 'Default agent type for new hatches:',
      choices: [
        { name: '🤖 Trading - Autonomous pump.fun trader', value: 'trading' },
        { name: '📱 Social - Community manager', value: 'social' },
        { name: '🔬 Research - Data aggregator', value: 'research' },
        { name: '🎨 Creative - Content generator', value: 'creative' },
        { name: '🌐 General Purpose - Full autonomy', value: 'general' },
      ],
      default: 'general',
    },
    {
      type: 'input',
      name: 'timezone',
      message: 'Timezone for scheduled tasks:',
      default: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  ]);

  // Update config
  const config = getConfig();
  config.defaultAgentType = agentType;
  config.timezone = timezone;

  // Success message
  console.log(boxen(
    chalk.green('✓ OpenTuna initialized successfully!\n\n') +
    chalk.white('Next steps:\n') +
    chalk.gray('  1. ') + chalk.cyan('opentuna hatch') + chalk.gray(' - Create a new agent\n') +
    chalk.gray('  2. ') + chalk.cyan('opentuna fins list') + chalk.gray(' - See available capabilities\n') +
    chalk.gray('  3. ') + chalk.cyan('opentuna run <script>') + chalk.gray(' - Run an agent script\n\n') +
    chalk.gray(`Config saved to: ${getConfigPath()}`),
    { 
      padding: 1, 
      margin: 1, 
      borderStyle: 'round',
      borderColor: 'cyan',
    }
  ));
}

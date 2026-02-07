/**
 * OpenTuna CLI - Hatch Command
 * Create a new autonomous agent
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import boxen from 'boxen';
import { getApiKey, getConfigValue, setConfigValue, isConfigured } from '../config';

interface HatchOptions {
  type?: 'trading' | 'social' | 'research' | 'creative' | 'general';
  name?: string;
  personality?: string;
  goal?: string;
  interactive?: boolean;
}

const AGENT_TYPES = {
  trading: {
    name: 'Trading Agent',
    icon: '📈',
    description: 'Autonomous pump.fun trader with Jupiter V6 + Jito MEV protection',
    defaultPersonality: 'Analytical, data-driven, risk-aware but opportunistic',
    defaultGoal: 'Identify high-potential tokens and execute profitable trades',
  },
  social: {
    name: 'Social Agent',
    icon: '💬',
    description: 'Community manager for X, Telegram, Discord, and SubTuna',
    defaultPersonality: 'Friendly, engaging, responsive, brand-aware',
    defaultGoal: 'Build and nurture an active community around tokens',
  },
  research: {
    name: 'Research Agent',
    icon: '🔬',
    description: 'Data aggregator and market analyst with web browsing',
    defaultPersonality: 'Thorough, objective, detail-oriented, citation-focused',
    defaultGoal: 'Gather and synthesize market intelligence for decision-making',
  },
  creative: {
    name: 'Creative Agent',
    icon: '🎨',
    description: 'Content generator for memes, marketing, and viral content',
    defaultPersonality: 'Witty, trendy, visually-minded, culturally-aware',
    defaultGoal: 'Create engaging content that drives attention and engagement',
  },
  general: {
    name: 'General Purpose Agent',
    icon: '🌐',
    description: 'Full autonomy - read/write, browse, execute, trade',
    defaultPersonality: 'Adaptive, versatile, goal-oriented, resourceful',
    defaultGoal: 'Accomplish assigned tasks using all available capabilities',
  },
};

export async function hatchCommand(options: HatchOptions): Promise<void> {
  // Check configuration
  if (!isConfigured()) {
    console.log(chalk.red('\n❌ OpenTuna is not configured.'));
    console.log(chalk.gray('   Run: opentuna init\n'));
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.red('\n❌ API key not found.'));
    console.log(chalk.gray('   Run: opentuna init\n'));
    return;
  }

  console.log(chalk.cyan('\n🥚 Hatching a New Agent\n'));

  let agentType = options.type;
  let agentName = options.name;
  let personality = options.personality;
  let goal = options.goal;

  // Interactive mode
  if (options.interactive !== false && (!agentType || !agentName)) {
    // Step 1: Select type
    if (!agentType) {
      const { type } = await inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: 'What type of agent do you want to create?',
        choices: Object.entries(AGENT_TYPES).map(([key, info]) => ({
          name: `${info.icon} ${info.name} - ${info.description}`,
          value: key,
        })),
        default: getConfigValue('defaultAgentType') || 'general',
      }]);
      agentType = type as HatchOptions['type'];
    }

    const typeInfo = AGENT_TYPES[agentType!];
    console.log(chalk.gray(`\n   ${typeInfo.icon} ${typeInfo.name}: ${typeInfo.description}\n`));

    // Step 2: Name
    if (!agentName) {
      const { name } = await inquirer.prompt([{
        type: 'input',
        name: 'name',
        message: 'What should we call your agent?',
        validate: (input) => {
          if (!input || input.length < 2) return 'Name must be at least 2 characters';
          if (input.length > 50) return 'Name must be less than 50 characters';
          return true;
        },
      }]);
      agentName = name;
    }

    // Step 3: Personality (optional)
    if (!personality) {
      const { customPersonality } = await inquirer.prompt([{
        type: 'confirm',
        name: 'customPersonality',
        message: 'Would you like to customize the personality?',
        default: false,
      }]);

      if (customPersonality) {
        const { pers } = await inquirer.prompt([{
          type: 'input',
          name: 'pers',
          message: 'Describe the personality:',
          default: typeInfo.defaultPersonality,
        }]);
        personality = pers;
      } else {
        personality = typeInfo.defaultPersonality;
      }
    }

    // Step 4: Goal (optional)
    if (!goal) {
      const { customGoal } = await inquirer.prompt([{
        type: 'confirm',
        name: 'customGoal',
        message: 'Would you like to set an initial goal?',
        default: false,
      }]);

      if (customGoal) {
        const { g } = await inquirer.prompt([{
          type: 'input',
          name: 'g',
          message: 'What is the initial goal?',
          default: typeInfo.defaultGoal,
        }]);
        goal = g;
      } else {
        goal = typeInfo.defaultGoal;
      }
    }

    // Confirmation
    console.log(chalk.gray('\n─────────────────────────────────────\n'));
    console.log(chalk.white('  Agent Configuration:'));
    console.log(chalk.gray(`  Type:        ${typeInfo.icon} ${typeInfo.name}`));
    console.log(chalk.gray(`  Name:        ${agentName}`));
    console.log(chalk.gray(`  Personality: ${personality?.slice(0, 50)}${personality && personality.length > 50 ? '...' : ''}`));
    console.log(chalk.gray(`  Goal:        ${goal?.slice(0, 50)}${goal && goal.length > 50 ? '...' : ''}`));
    console.log(chalk.gray('\n─────────────────────────────────────\n'));

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Ready to hatch this agent?',
      default: true,
    }]);

    if (!confirm) {
      console.log(chalk.yellow('\n   Hatching cancelled.\n'));
      return;
    }
  }

  // Use defaults if not provided
  agentType = agentType || 'general';
  agentName = agentName || `Agent-${Date.now().toString(36)}`;
  personality = personality || AGENT_TYPES[agentType].defaultPersonality;
  goal = goal || AGENT_TYPES[agentType].defaultGoal;

  // Create agent
  const spinner = ora('Hatching agent...').start();

  try {
    const response = await fetch('https://ptwytypavumcrbofspno.supabase.co/functions/v1/opentuna-hatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: agentName,
        type: agentType,
        personality,
        goal,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    const result = await response.json();
    spinner.succeed('Agent hatched successfully!');

    // Save last hatch info
    setConfigValue('lastHatch', {
      agentId: result.agentId,
      name: agentName,
      type: agentType,
      createdAt: new Date().toISOString(),
    });

    // Display result
    const typeInfo = AGENT_TYPES[agentType];
    console.log(boxen(
      chalk.green(`${typeInfo.icon} ${agentName} is alive!\n\n`) +
      chalk.white('Agent Details:\n') +
      chalk.gray(`  ID:       ${result.agentId}\n`) +
      chalk.gray(`  Type:     ${typeInfo.name}\n`) +
      chalk.gray(`  Wallet:   ${result.walletAddress}\n`) +
      (result.tokenMint ? chalk.gray(`  Token:    ${result.tokenMint}\n`) : '') +
      chalk.white('\nNext steps:\n') +
      chalk.gray('  • ') + chalk.cyan('opentuna fund 0.5') + chalk.gray(' - Fund the agent wallet\n') +
      chalk.gray('  • ') + chalk.cyan('opentuna sonar set cruise') + chalk.gray(' - Start autonomous activity\n') +
      chalk.gray('  • ') + chalk.cyan('opentuna fins rack') + chalk.gray(' - View installed capabilities'),
      { 
        padding: 1, 
        margin: 1, 
        borderStyle: 'round',
        borderColor: 'green',
      }
    ));

  } catch (error) {
    spinner.fail('Failed to hatch agent');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

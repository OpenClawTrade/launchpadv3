/**
 * OpenTuna CLI - Current (Wallet) Command
 * Manage agent wallet and funds
 */

import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { getApiKey, isConfigured } from '../config';

type CurrentAction = 'fund' | 'balance' | 'withdraw';

interface CurrentOptions {
  amount?: string;
  to?: string;
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

export async function currentCommand(action: CurrentAction, options: CurrentOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.red('\n❌ OpenTuna is not configured.'));
    console.log(chalk.gray('   Run: opentuna init\n'));
    return;
  }

  switch (action) {
    case 'fund':
      await fundWallet(options.amount!);
      break;
    case 'balance':
      await showBalance();
      break;
    case 'withdraw':
      await withdrawFunds(options.amount!, options.to);
      break;
  }
}

async function showBalance(): Promise<void> {
  const spinner = ora('Fetching wallet balance...').start();

  try {
    const result = await apiCall('opentuna-wallet-balance', {}) as {
      walletAddress: string;
      balanceSol: number;
      balanceLamports: number;
      activationThreshold: number;
      isActivated: boolean;
      pendingFees: number;
      totalEarned: number;
    };

    spinner.stop();

    const activationProgress = Math.min(100, (result.balanceSol / result.activationThreshold) * 100);
    const progressBar = '█'.repeat(Math.floor(activationProgress / 10)) + 
                       '░'.repeat(10 - Math.floor(activationProgress / 10));

    console.log(boxen(
      chalk.cyan('💰 Agent Wallet\n\n') +
      chalk.white(`Address: `) + chalk.gray(result.walletAddress) + '\n\n' +
      chalk.white(`Balance: `) + chalk.green(`${result.balanceSol.toFixed(4)} SOL`) + '\n' +
      chalk.gray(`         (${result.balanceLamports.toLocaleString()} lamports)\n\n`) +
      chalk.white(`Activation: `) + 
        (result.isActivated 
          ? chalk.green('✓ Activated')
          : chalk.yellow(`${result.balanceSol.toFixed(2)}/${result.activationThreshold} SOL`)) + '\n' +
      (result.isActivated 
        ? '' 
        : chalk.gray(`            [${progressBar}] ${activationProgress.toFixed(0)}%\n`)) + '\n' +
      chalk.gray('─────────────────────────────\n') +
      chalk.white(`Pending Fees: `) + chalk.cyan(`${result.pendingFees.toFixed(4)} SOL`) + '\n' +
      chalk.white(`Total Earned: `) + chalk.gray(`${result.totalEarned.toFixed(4)} SOL`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
      }
    ));

    if (!result.isActivated) {
      const needed = result.activationThreshold - result.balanceSol;
      console.log(chalk.yellow(`\n   ⚠️  Agent needs ${needed.toFixed(4)} more SOL to activate.`));
      console.log(chalk.gray(`   Fund with: opentuna fund ${needed.toFixed(2)}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to fetch balance');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function fundWallet(amount: string): Promise<void> {
  const amountSol = parseFloat(amount);
  
  if (isNaN(amountSol) || amountSol <= 0) {
    console.log(chalk.red('\n❌ Invalid amount'));
    console.log(chalk.gray('   Usage: opentuna fund <amount>\n'));
    return;
  }

  if (amountSol < 0.001) {
    console.log(chalk.red('\n❌ Minimum funding amount is 0.001 SOL\n'));
    return;
  }

  const spinner = ora('Getting deposit address...').start();

  try {
    const result = await apiCall('opentuna-wallet-deposit', { amount: amountSol }) as {
      walletAddress: string;
      qrCodeUrl?: string;
    };

    spinner.stop();

    console.log(boxen(
      chalk.cyan(`💳 Fund Agent Wallet\n\n`) +
      chalk.white(`Amount: `) + chalk.green(`${amountSol} SOL\n\n`) +
      chalk.white(`Send SOL to this address:\n`) +
      chalk.yellow(`${result.walletAddress}\n\n`) +
      chalk.gray('After sending, the balance will update automatically.\n') +
      chalk.gray('Check with: opentuna balance'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
      }
    ));

    // Copy to clipboard hint
    console.log(chalk.gray('\n   Tip: Copy the address and send SOL from your wallet.\n'));
  } catch (error) {
    spinner.fail('Failed to get deposit address');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

async function withdrawFunds(amount: string, toAddress?: string): Promise<void> {
  const amountSol = parseFloat(amount);
  
  if (isNaN(amountSol) || amountSol <= 0) {
    console.log(chalk.red('\n❌ Invalid amount'));
    console.log(chalk.gray('   Usage: opentuna withdraw <amount> --to <address>\n'));
    return;
  }

  // Get destination address if not provided
  let destination = toAddress;
  if (!destination) {
    const { address } = await inquirer.prompt([{
      type: 'input',
      name: 'address',
      message: 'Destination wallet address:',
      validate: (input) => {
        if (!input || input.length < 32) return 'Invalid wallet address';
        return true;
      },
    }]);
    destination = address;
  }

  // Confirm withdrawal
  console.log(chalk.yellow(`\n⚠️  Withdrawal Details:`));
  console.log(chalk.gray(`   Amount: ${amountSol} SOL`));
  console.log(chalk.gray(`   To: ${destination}\n`));

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Confirm withdrawal?',
    default: false,
  }]);

  if (!confirm) {
    console.log(chalk.yellow('\n   Withdrawal cancelled.\n'));
    return;
  }

  const spinner = ora('Processing withdrawal...').start();

  try {
    const result = await apiCall('opentuna-wallet-withdraw', {
      amount: amountSol,
      destination,
    }) as {
      success: boolean;
      signature: string;
      amountSol: number;
    };

    spinner.succeed('Withdrawal successful!');
    
    console.log(chalk.gray(`\n   Amount: ${result.amountSol} SOL`));
    console.log(chalk.gray(`   Signature: ${result.signature.slice(0, 20)}...`));
    console.log(chalk.gray(`   View: https://solscan.io/tx/${result.signature}\n`));
  } catch (error) {
    spinner.fail('Withdrawal failed');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

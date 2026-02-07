/**
 * OpenTuna CLI - Run Command
 * Execute agent scripts
 */

import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { getApiKey, isConfigured } from '../config';

interface RunOptions {
  watch?: boolean;
  env?: string;
}

export async function runCommand(script: string, options: RunOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.red('\n❌ OpenTuna is not configured.'));
    console.log(chalk.gray('   Run: opentuna init\n'));
    return;
  }

  // Check if script exists
  const scriptPath = path.resolve(process.cwd(), script);
  
  if (!fs.existsSync(scriptPath)) {
    console.log(chalk.red(`\n❌ Script not found: ${script}`));
    console.log(chalk.gray(`   Looked in: ${scriptPath}\n`));
    return;
  }

  // Load environment if specified
  if (options.env) {
    const envPath = path.resolve(process.cwd(), options.env);
    if (fs.existsSync(envPath)) {
      console.log(chalk.gray(`Loading environment from ${options.env}...`));
      loadEnvFile(envPath);
    }
  }

  console.log(chalk.cyan(`\n🏃 Running: ${script}\n`));

  // Set up environment
  const apiKey = getApiKey();
  if (apiKey) {
    process.env.OPENTUNA_API_KEY = apiKey;
  }
  process.env.OPENTUNA_BASE_URL = 'https://ptwytypavumcrbofspno.supabase.co/functions/v1';

  // Run the script
  const spinner = ora('Executing script...').start();

  try {
    // For TypeScript files, we need ts-node or similar
    const ext = path.extname(script);
    
    if (ext === '.ts') {
      // Use dynamic import for ESM compatibility
      const { spawn } = await import('child_process');
      
      const child = spawn('npx', ['ts-node', scriptPath], {
        stdio: 'inherit',
        env: process.env,
        shell: true,
      });

      spinner.stop();

      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green('\n✓ Script completed successfully.\n'));
            resolve();
          } else {
            console.log(chalk.red(`\n✗ Script exited with code ${code}\n`));
            reject(new Error(`Exit code: ${code}`));
          }
        });
        child.on('error', reject);
      });
    } else if (ext === '.js' || ext === '.mjs') {
      // For JavaScript, we can use dynamic import or spawn node
      const { spawn } = await import('child_process');
      
      const child = spawn('node', [scriptPath], {
        stdio: 'inherit',
        env: process.env,
      });

      spinner.stop();

      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green('\n✓ Script completed successfully.\n'));
            resolve();
          } else {
            console.log(chalk.red(`\n✗ Script exited with code ${code}\n`));
            reject(new Error(`Exit code: ${code}`));
          }
        });
        child.on('error', reject);
      });
    } else {
      spinner.fail(`Unsupported file type: ${ext}`);
      console.log(chalk.gray('   Supported: .ts, .js, .mjs\n'));
      return;
    }

    // Watch mode
    if (options.watch) {
      console.log(chalk.gray('Watching for changes... (Ctrl+C to stop)\n'));
      
      let debounceTimer: NodeJS.Timeout | null = null;
      
      fs.watch(scriptPath, (eventType) => {
        if (eventType === 'change') {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            console.log(chalk.yellow('\n📝 File changed, re-running...\n'));
            runCommand(script, { ...options, watch: false });
          }, 500);
        }
      });

      // Keep process alive
      await new Promise(() => {});
    }
  } catch (error) {
    spinner.fail('Script execution failed');
    console.error(chalk.red(`\n   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
  }
}

function loadEnvFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=');
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key.trim()] = value;
    }
  }
}

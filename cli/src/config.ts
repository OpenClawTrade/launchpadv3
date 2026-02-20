/**
 * Claw CLI Configuration
 * Manages ~/.claw/config.json
 */

import Conf from 'conf';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export interface ClawConfig {
  apiKey?: string;
  agentId?: string;
  baseUrl: string;
  defaultAgentType: 'trading' | 'social' | 'research' | 'creative' | 'general';
  sonarMode: 'drift' | 'cruise' | 'hunt' | 'frenzy';
  timezone: string;
  autoConfirm: boolean;
  connectedServices: {
    email?: { provider: string; email: string };
    slack?: { teamName: string };
    discord?: { botName: string };
    whatsapp?: { phoneNumber: string };
    google?: { email: string };
    notion?: { workspaceName: string };
  };
  lastHatch?: {
    agentId: string;
    name: string;
    type: string;
    createdAt: string;
  };
}

// Keep legacy name for backwards compat with existing configs
export type OpenTunaConfig = ClawConfig;

const CONFIG_DIR = path.join(os.homedir(), '.claw');
const CONFIG_FILE = 'config.json';

const defaults: ClawConfig = {
  baseUrl: 'https://ptwytypavumcrbofspno.supabase.co/functions/v1',
  defaultAgentType: 'general',
  sonarMode: 'cruise',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoConfirm: false,
  connectedServices: {},
};

const config = new Conf<ClawConfig>({
  projectName: 'claw',
  projectSuffix: '',
  cwd: CONFIG_DIR,
  configName: 'config',
  defaults,
});

// Ensure config directory exists
export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Get full config
export function getConfig(): ClawConfig {
  ensureConfigDir();
  return config.store;
}

// Get specific config value
export function getConfigValue<K extends keyof ClawConfig>(key: K): ClawConfig[K] {
  return config.get(key);
}

// Set config value
export function setConfigValue<K extends keyof ClawConfig>(
  key: K, 
  value: ClawConfig[K]
): void {
  ensureConfigDir();
  config.set(key, value);
}

// Set API key
export function setApiKey(apiKey: string): void {
  setConfigValue('apiKey', apiKey);
}

// Get API key
export function getApiKey(): string | undefined {
  return getConfigValue('apiKey');
}

// Set agent ID
export function setAgentId(agentId: string): void {
  setConfigValue('agentId', agentId);
}

// Get agent ID
export function getAgentId(): string | undefined {
  return getConfigValue('agentId');
}

// Check if configured
export function isConfigured(): boolean {
  const apiKey = getApiKey();
  return !!apiKey;
}

// Reset configuration
export function resetConfig(): void {
  config.clear();
  Object.entries(defaults).forEach(([key, value]) => {
    config.set(key as keyof ClawConfig, value);
  });
}

// Update connected service
export function updateConnectedService(
  service: keyof ClawConfig['connectedServices'],
  data: ClawConfig['connectedServices'][typeof service]
): void {
  const services = getConfigValue('connectedServices') || {};
  services[service] = data;
  setConfigValue('connectedServices', services);
}

// Remove connected service
export function removeConnectedService(
  service: keyof ClawConfig['connectedServices']
): void {
  const services = getConfigValue('connectedServices') || {};
  delete services[service];
  setConfigValue('connectedServices', services);
}

// Get config file path
export function getConfigPath(): string {
  return path.join(CONFIG_DIR, CONFIG_FILE);
}

// Export config store for direct access
export { config };

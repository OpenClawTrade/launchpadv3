export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
} as const;

export const DBC_API_URL = 'https://dbc-api.meteora.ag';
export const TOTAL_SUPPLY = 1_000_000_000;
export const GRADUATION_THRESHOLD_SOL = 85;

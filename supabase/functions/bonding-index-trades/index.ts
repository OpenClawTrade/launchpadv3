// Indexes Buy/Sell logs from each Popshiba bonding curve into bonding_trades,
// recomputes top-holder balances + market metrics, and writes them back to
// bonding_tokens. Designed to be called on-demand by the token detail page
// (POST { token_address }) so the UI never has to fan out to RPC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createPublicClient, http, parseAbiItem, formatEther, getAddress, type Address, type Log } from 'https://esm.sh/viem@2.21.0';
import { mainnet } from 'https://esm.sh/viem@2.21.0/chains';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Real curve event signatures (recovered + observed live)
const BUY_EVENT  = parseAbiItem('event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee, uint256 newRealEth, uint256 newRealTokens)');
const SELL_EVENT = parseAbiItem('event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 fee, uint256 newRealEth, uint256 newRealTokens)');
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

const RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
];

async function makeClient() {
  for (const url of RPCS) {
    try {
      const c = createPublicClient({ chain: mainnet, transport: http(url) });
      await c.getBlockNumber();
      return c;
    } catch { /* try next */ }
  }
  throw new Error('All RPC endpoints failed');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { token_address } = await req.json();
    if (!token_address) throw new Error('token_address required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: token } = await supabase
      .from('bonding_tokens')
      .select('*')
      .eq('token_address', token_address.toLowerCase())
      .maybeSingle();
    if (!token) throw new Error('token not found');

    const tokenAddr = getAddress(token.token_address) as Address;
    const curveAddr = getAddress(token.curve_address) as Address;
    const startBlock = BigInt(token.block_number ?? 0);

    const client = await makeClient();
    const latest = await client.getBlockNumber();

    // Pull all Buy/Sell logs from the curve in chunks (50k blocks max per call)
    const trades: Array<{ side: 'buy'|'sell'; tx: string; block: bigint; logIndex: number; trader: string; eth: string; tokens: string }> = [];
    const transfers: Log[] = [];

    let from = startBlock;
    while (from <= latest) {
      const to = from + 49999n > latest ? latest : from + 49999n;
      const [buys, sells, xfers] = await Promise.all([
        client.getLogs({ address: curveAddr, event: BUY_EVENT, fromBlock: from, toBlock: to }).catch(() => []),
        client.getLogs({ address: curveAddr, event: SELL_EVENT, fromBlock: from, toBlock: to }).catch(() => []),
        client.getLogs({ address: tokenAddr, event: TRANSFER_EVENT, fromBlock: from, toBlock: to }).catch(() => []),
      ]);
      for (const l of buys as any[]) {
        trades.push({
          side: 'buy', tx: l.transactionHash, block: l.blockNumber, logIndex: l.logIndex,
          trader: (l.args.buyer as string).toLowerCase(),
          eth: l.args.ethIn.toString(), tokens: l.args.tokensOut.toString(),
        });
      }
      for (const l of sells as any[]) {
        trades.push({
          side: 'sell', tx: l.transactionHash, block: l.blockNumber, logIndex: l.logIndex,
          trader: (l.args.seller as string).toLowerCase(),
          eth: l.args.ethOut.toString(), tokens: l.args.tokensIn.toString(),
        });
      }
      transfers.push(...xfers);
      from = to + 1n;
    }

    // Get current ETH price for USD market cap
    let ethUsd = 0;
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const j = await r.json();
      ethUsd = j?.ethereum?.usd ?? 0;
    } catch { /* non-fatal */ }

    // Persist trades (upsert by tx_hash unique)
    if (trades.length) {
      const rows = trades.map((t) => {
        const ethN = Number(formatEther(BigInt(t.eth)));
        const tokN = Number(formatEther(BigInt(t.tokens)));
        const priceEth = tokN > 0 ? ethN / tokN : 0;
        return {
          token_address: token.token_address,
          curve_address: token.curve_address,
          trader_address: t.trader,
          side: t.side,
          eth_amount: ethN,
          token_amount: tokN,
          price_eth: priceEth,
          price_usd: priceEth * ethUsd,
          tx_hash: t.tx,
          block_number: Number(t.block),
          log_index: t.logIndex,
        };
      });
      // upsert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('bonding_trades').upsert(rows.slice(i, i + 500), { onConflict: 'tx_hash' });
      }
    }

    // Compute holder balances from transfer log replay
    const balances = new Map<string, bigint>();
    for (const l of transfers as any[]) {
      const from = (l.args.from as string).toLowerCase();
      const to = (l.args.to as string).toLowerCase();
      const v = BigInt(l.args.value);
      if (from !== '0x0000000000000000000000000000000000000000') {
        balances.set(from, (balances.get(from) ?? 0n) - v);
      }
      if (to !== '0x0000000000000000000000000000000000000000') {
        balances.set(to, (balances.get(to) ?? 0n) + v);
      }
    }
    // Drop curve & zero balances from holder list
    balances.delete(token.curve_address.toLowerCase());
    const TOTAL = 1_000_000_000n * 10n ** 18n;
    const holders = [...balances.entries()]
      .filter(([, b]) => b > 0n)
      .sort((a, b) => (b[1] > a[1] ? 1 : -1));

    // Replace top 100 holders
    await supabase.from('bonding_holders').delete().eq('token_address', token.token_address);
    if (holders.length) {
      const rows = holders.slice(0, 100).map(([addr, bal]) => ({
        token_address: token.token_address,
        holder_address: addr,
        balance: Number(formatEther(bal)),
        percentage: Number((bal * 10000n) / TOTAL) / 100,
      }));
      await supabase.from('bonding_holders').insert(rows);
    }

    // Compute live curve metrics
    const VIRTUAL_ETH = 1_060_000_000_000_000_000n;
    const VIRTUAL_TOKENS = 1_073_000_000n * 10n ** 18n;
    const GRAD_THRESHOLD = 3_000_000_000_000_000_000n;

    let realEthN = 0, realTokN = 0, priceEth = 0, mcapUsd = 0, progressBps = 0;
    try {
      const [realEth, realTok] = await Promise.all([
        client.readContract({ address: curveAddr, abi: [parseAbiItem('function realEthReserves() view returns (uint256)')], functionName: 'realEthReserves' }) as Promise<bigint>,
        client.readContract({ address: curveAddr, abi: [parseAbiItem('function realTokenReserves() view returns (uint256)')], functionName: 'realTokenReserves' }) as Promise<bigint>,
      ]);
      realEthN = Number(formatEther(realEth));
      realTokN = Number(formatEther(realTok));
      const ve = VIRTUAL_ETH + realEth;
      const vt = VIRTUAL_TOKENS - (792_857_143n * 10n ** 18n - realTok);
      priceEth = Number(ve) / Number(vt > 0n ? vt : 1n);
      mcapUsd = priceEth * 1_000_000_000 * ethUsd;
      progressBps = Number((realEth * 10000n) / GRAD_THRESHOLD);
    } catch { /* non-fatal */ }

    const lastTrade = trades.length ? new Date().toISOString() : null;

    await supabase.from('bonding_tokens').update({
      market_cap_usd: mcapUsd || null,
      price_eth: priceEth || null,
      real_eth_reserves: realEthN,
      real_token_reserves: realTokN,
      progress_bps: progressBps,
      holder_count: holders.length,
      total_trades: trades.length,
      last_trade_at: lastTrade,
    }).eq('token_address', token.token_address);

    return new Response(JSON.stringify({
      ok: true,
      trades: trades.length,
      holders: holders.length,
      progress_bps: progressBps,
      market_cap_usd: mcapUsd,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});

INSERT INTO eth_lp_positions (token_address, pool_address, lp_token_id, creator_wallet, platform_owner, fee_tier, tick_lower, tick_upper, chain_id)
SELECT
  lower(lr.token_address),
  lower(lr.uniswap_pool_address),
  lr.lp_token_id::numeric,
  lower(lr.creator_wallet),
  '0x8f7017df748db75a58b3aa441ea0886dfec16906',
  10000,
  -887200,
  887200,
  1
FROM eth_launch_requests lr
WHERE lr.status = 'live'
  AND lr.token_address IS NOT NULL
  AND lr.uniswap_pool_address IS NOT NULL
  AND lr.lp_token_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM eth_lp_positions p WHERE p.token_address = lower(lr.token_address)
  );
# TRENCHES Launchpad - Technical Roadmap

> Comprehensive roadmap integrating TRENCHES social platform with advanced trading features inspired by axiom.trade

---

## 📊 Current Implementation Status

### ✅ Core Infrastructure (COMPLETE)

| Component | Status | Technical Details |
|-----------|--------|-------------------|
| **Bonding Curve Engine** | ✅ Live | Constant product (x·y=k), 30 SOL virtual liquidity |
| **Graduation Mechanism** | ✅ Live | Auto-migrate at 85 SOL real reserves to Meteora DAMM V2 |
| **Fee Distribution** | ✅ Live | 2% trading fee, 50/50 creator/platform split |
| **LP Token Lockup** | ✅ Live | 100% LP locked to treasury (7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2) |
| **Real-time Price Charts** | ✅ Live | `token_price_history` table, 1-minute candles |
| **Token Comments** | ✅ Live | Threaded discussion per token |
| **Transaction History** | ✅ Live | Full on-chain tx logging |
| **Holder Tracking** | ✅ Live | `token_holdings` with real-time balance updates |

### 🔧 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRENCHES Platform                            │
├─────────────────────────────────────────────────────────────────────┤
│  Frontend (React/Vite)                                              │
│  ├── LaunchpadPage.tsx      → Token discovery & filtering          │
│  ├── LaunchTokenPage.tsx    → bags.fm-style token creation         │
│  ├── TokenDetailPage.tsx    → Trading interface + charts           │
│  ├── PortfolioPage.tsx      → Holdings & earnings dashboard        │
│  └── EarningsPage.tsx       → Fee claim management                 │
├─────────────────────────────────────────────────────────────────────┤
│  API Layer (Vercel Node.js)                                         │
│  ├── /api/pool/create       → Meteora DBC pool creation            │
│  ├── /api/swap/execute      → On-chain swap execution              │
│  ├── /api/fees/claim        → Creator fee claims                   │
│  └── /api/data/sync         → DexScreener data sync                │
├─────────────────────────────────────────────────────────────────────┤
│  Database (Supabase/Lovable Cloud)                                  │
│  ├── tokens                 → Token metadata & reserves            │
│  ├── token_holdings         → Wallet balances per token            │
│  ├── launchpad_transactions → All buy/sell history                 │
│  ├── token_price_history    → OHLCV candle data                    │
│  ├── token_comments         → Threaded discussions                 │
│  └── fee_earners            → Creator/system fee tracking          │
├─────────────────────────────────────────────────────────────────────┤
│  On-Chain (Solana)                                                  │
│  ├── Meteora DBC            → Bonding curve pools                  │
│  ├── Meteora DAMM V2        → Graduated liquidity pools            │
│  └── Helius RPC             → High-performance node access         │
└─────────────────────────────────────────────────────────────────────┘
```

### 💰 Economic Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `INITIAL_VIRTUAL_SOL` | 30 SOL | Starting virtual liquidity |
| `GRADUATION_THRESHOLD_SOL` | 85 SOL | Real SOL needed to graduate |
| `TOTAL_SUPPLY` | 1,000,000,000 | Tokens per launch |
| `TOKEN_DECIMALS` | 6 | SPL token decimals |
| `TRADING_FEE_BPS` | 200 (2%) | Fee on each trade |
| `CREATOR_FEE_SHARE` | 50% | Creator's portion of fees |
| `SYSTEM_FEE_SHARE` | 50% | Platform's portion of fees |
| `MIGRATED_POOL_FEE_BPS` | 200 (2%) | Fee on DAMM V2 post-graduation |

---

## 🗺️ ROADMAP

### Phase 1: Core Trading Enhancement (Q1 2026)

#### 1.1 Advanced Order Types
**Priority: HIGH | Effort: Medium**

| Feature | Description | Technical Implementation |
|---------|-------------|-------------------------|
| **Limit Orders** | Set target buy/sell prices | Off-chain order book with on-chain settlement |
| **Stop-Loss Orders** | Auto-sell at threshold | Price monitoring daemon + tx execution |
| **Take-Profit Orders** | Auto-sell at target | Price monitoring daemon + tx execution |
| **DCA (Dollar Cost Average)** | Scheduled recurring buys | Cron-based tx scheduler |

```typescript
// New table schema
interface LimitOrder {
  id: string;
  token_id: string;
  user_wallet: string;
  order_type: 'limit_buy' | 'limit_sell' | 'stop_loss' | 'take_profit';
  trigger_price: number;
  amount: number;
  status: 'pending' | 'executed' | 'cancelled' | 'expired';
  created_at: string;
  expires_at: string;
}
```

#### 1.2 Quick Buy/Sell Interface (Axiom-Inspired)
**Priority: HIGH | Effort: Low**

- One-click buy buttons (0.1, 0.5, 1, 5 SOL presets)
- One-click sell buttons (25%, 50%, 75%, 100% of holdings)
- Keyboard shortcuts for rapid trading
- Sound effects for trade confirmations

#### 1.3 Slippage & MEV Protection
**Priority: HIGH | Effort: Medium**

| Feature | Description |
|---------|-------------|
| **Custom Slippage** | User-adjustable (0.1% - 50%) |
| **MEV Protection** | Jito bundle routing to prevent sandwich attacks |
| **Priority Fees** | Configurable priority fee for faster inclusion |
| **Transaction Retry** | Auto-retry with increased priority on failure |

---

### Phase 2: Discovery & Analytics (Q1-Q2 2026)

#### 2.1 TRENCHES Pulse (Token Discovery - Axiom-Inspired)
**Priority: HIGH | Effort: High**

Real-time token lifecycle tracking:

| Section | Description | Filters |
|---------|-------------|---------|
| **New Launches** | Tokens < 5 min old | Age, Dev %, Liquidity |
| **Bonding Progress** | Tokens 50-99% bonded | Progress %, Volume, Holders |
| **Recently Graduated** | Migrated in last 1h | Market Cap, Volume, Price Change |
| **Trending** | Highest velocity | 24h Volume, Holder Growth, Social Mentions |

**Smart Filters:**
- Top 10 Holders % (decentralization metric)
- Dev Holding % (rug risk indicator)
- Sniper % (bot detection)
- Insider % (team allocation)
- Bundle % (coordinated trading)
- Pro Trader % (smart money tracking)

```typescript
interface TokenAnalytics {
  token_id: string;
  top_10_holders_pct: number;
  dev_holding_pct: number;
  sniper_pct: number;
  insider_pct: number;
  bundle_pct: number;
  pro_trader_pct: number;
  holder_growth_1h: number;
  volume_velocity: number;
  social_score: number;
}
```

#### 2.2 Wallet Tracking (Axiom-Inspired)
**Priority: MEDIUM | Effort: High**

Monitor and copy-trade successful wallets:

| Feature | Description |
|---------|-------------|
| **Add Wallets** | Track any Solana wallet by address |
| **Trade History** | See all their token trades |
| **PnL Analysis** | Win rate, avg profit, best trades |
| **Copy Trading** | Auto-execute their trades (with delay/limits) |
| **Alerts** | Push notifications on wallet activity |

```typescript
interface TrackedWallet {
  id: string;
  user_id: string;
  wallet_address: string;
  label: string;
  notifications_enabled: boolean;
  copy_trade_enabled: boolean;
  copy_trade_max_sol: number;
  copy_trade_delay_seconds: number;
}
```

#### 2.3 Social Integration (TRENCHES Unique Advantage)
**Priority: HIGH | Effort: Medium**

Leverage existing TRENCHES social features:

| Feature | Description |
|---------|-------------|
| **Token Posts** | Posts mentioning $TICKER auto-linked |
| **Creator Profiles** | Token creators linked to social profiles |
| **Social Score** | Token ranking by social engagement |
| **Trending Integration** | Tokens mentioned in trending hashtags |
| **In-feed Trading** | Buy/sell directly from post cards |
| **Post-to-Token** | Create token from post idea |

```sql
-- Auto-extract $TICKER mentions from posts
CREATE OR REPLACE FUNCTION extract_token_mentions()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract all $TICKER patterns and link to tokens
  INSERT INTO post_token_mentions (post_id, token_id)
  SELECT NEW.id, t.id
  FROM tokens t
  WHERE NEW.content ~* ('\$' || t.ticker || '\b');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### Phase 3: Advanced Trading Tools (Q2 2026)

#### 3.1 Sniper & Bundler Detection
**Priority: MEDIUM | Effort: High**

Identify suspicious trading patterns:

| Detection Type | Method | UI Indicator |
|---------------|--------|--------------|
| **Snipers** | First-block buys with high allocation | 🎯 Badge |
| **Bundlers** | Multiple wallets in same tx | 📦 Badge |
| **Insiders** | Pre-launch wallet activity | 🔒 Badge |
| **Whales** | >5% supply holders | 🐋 Badge |
| **Smart Money** | Wallets with high win rate | 💎 Badge |

#### 3.2 Migration Tools (Axiom-Inspired)
**Priority: HIGH | Effort: High**

Automated actions on token graduation:

| Feature | Description |
|---------|-------------|
| **Buy on Migration** | Auto-buy when token graduates to DAMM V2 |
| **Sell on Migration** | Auto-sell bonding curve holdings on graduation |
| **Migration Alerts** | Push notification when watched token migrates |
| **LP Tracking** | Monitor locked LP tokens post-graduation |

#### 3.3 Chart Enhancements
**Priority: MEDIUM | Effort: Medium**

| Feature | Description |
|---------|-------------|
| **TradingView Integration** | Professional charting library |
| **Technical Indicators** | RSI, MACD, Bollinger Bands, Volume Profile |
| **Drawing Tools** | Trendlines, Fibonacci, Support/Resistance |
| **Multi-timeframe** | 1m, 5m, 15m, 1h, 4h, 1d candles |
| **Trade Markers** | Show your trades on chart |

---

### Phase 4: Platform Expansion (Q2-Q3 2026)

#### 4.1 Fee Sharing System (bags.fm-Inspired)
**Priority: MEDIUM | Effort: Medium**

Allow creators to share trading fees:

| Feature | Description |
|---------|-------------|
| **Multi-earner Allocation** | Split fees with up to 100 addresses |
| **Twitter Handle Mapping** | Assign fees by @handle (resolved on-chain) |
| **Vesting Schedules** | Time-locked fee distributions |
| **Referral Fees** | Share fees with users who refer buyers |

```typescript
interface FeeAllocation {
  token_id: string;
  recipient_type: 'wallet' | 'twitter' | 'profile';
  recipient_identifier: string;
  share_bps: number; // Basis points (100 = 1%)
  vesting_end_date: string | null;
}
```

#### 4.2 Perpetual Trading Integration (Axiom-Style)
**Priority: LOW | Effort: Very High**

Leverage trading via Hyperliquid or similar:

| Feature | Description |
|---------|-------------|
| **Perp Trading** | Up to 50x leverage on major pairs |
| **Cross/Isolated Margin** | Flexible risk management |
| **Funding Rates** | Real-time funding display |
| **Separate Accounts** | Distinct spot vs perp balances |

#### 4.3 Yield & Staking
**Priority: LOW | Effort: Medium**

| Feature | Description |
|---------|-------------|
| **SOL Staking** | Jito liquid staking (jitoSOL) |
| **USDC Yield** | Marginfi lending integration |
| **LP Farming** | Stake graduated LP tokens |

---

### Phase 5: Mobile & UX (Q3 2026)

#### 5.1 Mobile App
**Priority: MEDIUM | Effort: Very High**

| Platform | Approach |
|----------|----------|
| **React Native** | Shared codebase with web |
| **Push Notifications** | Price alerts, wallet activity, social mentions |
| **Biometric Auth** | Face ID / Fingerprint for trading |
| **Widget Support** | Home screen price tickers |

#### 5.2 Notification System
**Priority: HIGH | Effort: Medium**

| Notification Type | Trigger |
|-------------------|---------|
| **Price Alerts** | Token hits target price |
| **Wallet Activity** | Tracked wallet trades |
| **Social Mentions** | $TICKER mentioned in posts |
| **Graduation Alerts** | Token migrates to DAMM V2 |
| **Order Fills** | Limit order executed |
| **Fee Claims** | New fees available to claim |

---

## 🔌 TRENCHES Social Integration Matrix

Unique advantage: Full social platform integration

| Social Feature | Launchpad Integration |
|---------------|----------------------|
| **Posts** | Embed token cards, $TICKER auto-linking |
| **Profiles** | Show created tokens, trading history, PnL |
| **Notifications** | Token mentions, follower trades, price alerts |
| **Trending** | Token leaderboard based on social velocity |
| **Communities** | Token-gated communities for holders |
| **DMs** | Trade discussions, deal negotiations |
| **Verified Badges** | Premium traders, top creators |
| **AI Assistant** | Trading advice, token analysis, market insights |

---

## 📈 Success Metrics

| Metric | Q1 Target | Q2 Target | Q3 Target |
|--------|-----------|-----------|-----------|
| Daily Active Traders | 1,000 | 5,000 | 15,000 |
| Daily Trading Volume | $100K | $1M | $10M |
| Tokens Launched | 100 | 1,000 | 5,000 |
| Graduation Rate | 10% | 15% | 20% |
| Creator Fee Claims | $10K | $100K | $500K |
| Social Mentions (daily) | 500 | 5,000 | 25,000 |

---

## 🛠️ Technical Dependencies

### Required Infrastructure

| Component | Provider | Purpose |
|-----------|----------|---------|
| **RPC Node** | Helius | High-performance Solana access |
| **Database** | Supabase/Lovable Cloud | Real-time data + auth |
| **API Hosting** | Vercel | Meteora SDK serverless functions |
| **Price Feeds** | DexScreener API | Market data aggregation |
| **Social Data** | Twitter API v2 | Handle resolution, feed monitoring |
| **Push Notifications** | Firebase/OneSignal | Mobile + web alerts |

### Environment Variables Required

```bash
# Existing (Configured)
HELIUS_RPC_URL=
TREASURY_PRIVATE_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Future (Phase 2+)
TWITTER_API_KEY=
TWITTER_API_SECRET=
JITO_BLOCK_ENGINE_URL=
HYPERLIQUID_API_KEY=
FIREBASE_SERVER_KEY=
```

---

## 🔐 Security Considerations

| Risk | Mitigation |
|------|------------|
| **Rug Pulls** | Creator reputation score, sniper/insider detection |
| **Front-running** | Jito MEV protection, priority fees |
| **API Abuse** | Rate limiting, API key authentication |
| **Wallet Security** | Non-custodial design, encrypted local storage |
| **Smart Contract** | Audited Meteora SDK, immutable token metadata |

---

## 📅 Release Timeline

```
Q1 2026
├── Jan: Quick Buy/Sell UI, Slippage Controls
├── Feb: Limit Orders, Stop-Loss/Take-Profit
└── Mar: TRENCHES Pulse v1, Basic Wallet Tracking

Q2 2026
├── Apr: Sniper/Bundler Detection, Migration Tools
├── May: Advanced Charts, Social Integration v2
└── Jun: Fee Sharing System, Notification System

Q3 2026
├── Jul: Mobile App Beta (iOS/Android)
├── Aug: Copy Trading, Pro Trader Signals
└── Sep: Perp Trading Integration, Yield Products
```

---

## 📝 Notes

- **TRENCHES Unique Value**: Unlike axiom.trade which is trading-only, TRENCHES combines social media with token trading, enabling viral loops and organic discovery
- **bags.fm Inspiration**: Minimal launch UI, collapsible sections, fee sharing capability
- **axiom.trade Inspiration**: Pulse discovery, wallet tracking, quick trade buttons, MEV protection
- **Competitive Advantage**: Existing social graph, verified profiles, trending algorithm, AI assistant

---

*Last Updated: January 2026*
*Version: 1.0*

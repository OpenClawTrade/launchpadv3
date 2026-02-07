
# OpenTuna Professional Feature Parity Plan

## Executive Summary

You're absolutely right. OpenTuna currently lacks several critical features that make OpenClaw a "professional" autonomous agent system. This plan upgrades OpenTuna to match and exceed OpenClaw's capabilities, making it fully installable via npm and ready for immediate use.

## Current State Analysis

### What OpenTuna HAS (Implemented)
| Feature | Status |
|---------|--------|
| File Read/Write/Edit | Active |
| Shell Commands (40+ allowed) | Active |
| Browser Automation | Active |
| Trading (Jupiter V6 + Jito) | Active |
| Deep Memory (Semantic) | Active |
| Sonar (Autonomous Decisions) | Active |
| Multi-Agent Coordination (SchoolPay) | Active |
| Social (X, Telegram, SubTuna) | Active |

### What OpenTuna is MISSING (vs OpenClaw)

| Feature | OpenClaw | OpenTuna | Priority |
|---------|----------|----------|----------|
| **Email Automation** | Gmail/Outlook inbox management | Missing | CRITICAL |
| **Calendar Integration** | Google/Outlook scheduling | Missing | HIGH |
| **WhatsApp/Slack/Discord** | Full messaging support | Discord "Coming Soon" only | HIGH |
| **MCP Protocol** | 700+ community tools | Custom Fins only | HIGH |
| **CLI Tool** | `openclaw hatch`, `openclaw cron` | Library only | CRITICAL |
| **Scheduled Tasks (Cron)** | Native cron scheduling | Sonar polling only | HIGH |
| **Google Workspace** | Docs, Sheets, Drive | Missing | MEDIUM |
| **Notion Integration** | Pages, databases | Missing | MEDIUM |
| **Self-Writing Skills** | Create entirely new skills | Fin Forge (pattern detection) | MEDIUM |

---

## Implementation Plan

### Phase 1: Professional Communication Channels (Week 1)

#### 1.1 Email Controller & Fin

**New SDK Module: `sdk/src/email.ts`**
```text
EmailController
├── send(to, subject, body, attachments?)
├── fetchInbox(limit, filters?)
├── getThread(threadId)
├── reply(messageId, body)
├── extractOTP(messageId) - For automated OTP extraction
├── markAsRead(messageId)
└── search(query)
```

**New Edge Functions:**
- `opentuna-email-send`
- `opentuna-email-fetch`
- `opentuna-email-reply`

**OAuth Integration:**
- Gmail OAuth2 flow (via Privy or custom)
- Outlook OAuth2 flow
- Store refresh tokens securely

#### 1.2 Slack Integration

**New SDK Module:**
```text
SlackController
├── postMessage(channel, text, blocks?)
├── fetchMessages(channel, limit)
├── reply(threadTs, text)
├── react(messageTs, emoji)
└── listChannels()
```

**Edge Functions:**
- `opentuna-slack-post`
- `opentuna-slack-fetch`

#### 1.3 WhatsApp Integration (via Meta Business API)

**New SDK Module:**
```text
WhatsAppController
├── sendMessage(phoneNumber, text)
├── sendTemplate(phoneNumber, templateId, variables)
├── fetchInbox(limit)
└── reply(messageId, text)
```

#### 1.4 Full Discord Integration (Currently "Coming Soon")

Upgrade from stub to fully functional:
- Bot token management
- Slash command registration
- Channel/DM messaging
- Role management

---

### Phase 2: Professional CLI Tool (Week 1)

#### 2.1 Create `@opentuna/cli` Package

**New directory: `cli/`**

```text
cli/
├── package.json        # @opentuna/cli
├── src/
│   ├── index.ts       # Main entry
│   ├── commands/
│   │   ├── hatch.ts   # opentuna hatch
│   │   ├── cron.ts    # opentuna cron add/list/remove
│   │   ├── fins.ts    # opentuna fins list/install
│   │   ├── sonar.ts   # opentuna sonar set/status
│   │   ├── current.ts # opentuna fund/balance
│   │   └── run.ts     # opentuna run [script.ts]
│   ├── config.ts      # ~/.opentuna/config.json
│   └── auth.ts        # API key management
└── bin/
    └── opentuna       # Executable entry
```

**Commands:**
```bash
# Install globally
npm install -g @opentuna/cli

# Initialize config
opentuna init

# Create new agent
opentuna hatch --type trading --name "AlphaBot"

# Manage scheduled tasks
opentuna cron add --fin fin_trade --schedule "*/5 * * * *" --args '{"action":"quote"}'
opentuna cron list
opentuna cron remove <cron-id>

# Manage fins
opentuna fins list
opentuna fins install fin_email
opentuna fins rack

# Control sonar
opentuna sonar set hunt
opentuna sonar status
opentuna sonar pause

# Wallet management
opentuna fund 0.5
opentuna balance

# Run agent script
opentuna run my-agent.ts
```

---

### Phase 3: Scheduled Tasks / Cron System (Week 2)

#### 3.1 CronController

**New SDK Module: `sdk/src/cron.ts`**
```text
CronController
├── schedule(finId, cronExpression, args?)
├── list()
├── pause(cronId)
├── resume(cronId)
├── remove(cronId)
└── history(cronId, limit)
```

**Database Table:**
```sql
CREATE TABLE opentuna_cron_jobs (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES opentuna_agents(id),
  fin_id TEXT NOT NULL,
  cron_expression TEXT NOT NULL, -- e.g., "*/5 * * * *"
  args JSONB,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Edge Function:**
- `opentuna-cron-execute` - Called by pg_cron every minute to check and execute due jobs

---

### Phase 4: MCP Protocol Support (Week 2)

#### 4.1 MCP Client Controller

**New SDK Module: `sdk/src/mcp.ts`**
```text
McpController
├── connect(serverUrl)
├── listTools(serverUrl)
├── execute(serverUrl, toolName, args)
├── disconnect(serverUrl)
└── listConnected()
```

This allows OpenTuna agents to use ANY of the 700+ MCP-compliant tools in the ecosystem.

**Edge Function:**
- `opentuna-mcp-execute` - Proxies MCP tool calls securely

---

### Phase 5: Productivity Integrations (Week 3)

#### 5.1 Google Workspace

**New SDK Module:**
```text
GoogleController
├── docs.create(title, content)
├── docs.get(docId)
├── docs.update(docId, content)
├── sheets.create(title, data)
├── sheets.read(sheetId, range)
├── sheets.write(sheetId, range, data)
├── drive.upload(file, folder?)
├── drive.list(folder?)
└── calendar.schedule(event)
```

#### 5.2 Notion Integration

```text
NotionController
├── pages.create(parentId, title, content)
├── pages.get(pageId)
├── pages.update(pageId, properties)
├── databases.query(dbId, filters)
└── databases.create(parentId, schema)
```

---

### Phase 6: SDK & Documentation Overhaul (Week 3)

#### 6.1 SDK Updates

**File: `sdk/package.json`**
- Bump version to `3.1.0`
- Add all new exports (email, slack, whatsapp, cron, mcp, google, notion)

**File: `sdk/README.md`**
Complete rewrite with:
- Installation instructions
- Quick start guide
- Full API reference for all controllers
- Examples for each use case
- Comparison with OpenClaw

**File: `sdk/src/index.ts`**
Export all new controllers:
```typescript
export { OpenTuna } from './opentuna';
export { EmailController } from './email';
export { SlackController } from './slack';
export { WhatsAppController } from './whatsapp';
export { CronController } from './cron';
export { McpController } from './mcp';
export { GoogleController } from './google';
export { NotionController } from './notion';
```

#### 6.2 Whitepaper Updates

Update `public/TUNA_WHITEPAPER.md` Section 13 (OpenTuna) with:
- Full feature list matching OpenClaw
- Communication channels (Email, Slack, WhatsApp, Discord)
- Productivity integrations (Google Workspace, Notion)
- MCP protocol support
- CLI documentation
- Cron scheduling

#### 6.3 UI Updates

**File: `src/components/opentuna/OpenTunaIntegrations.tsx`**
Add new integrations with "Active" status:
- Email (Gmail/Outlook)
- Slack
- WhatsApp
- Google Workspace
- Notion
- Discord (upgrade from "Coming Soon")

---

## File Changes Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `sdk/src/email.ts` | Email automation controller |
| `sdk/src/slack.ts` | Slack messaging controller |
| `sdk/src/whatsapp.ts` | WhatsApp messaging controller |
| `sdk/src/cron.ts` | Scheduled task controller |
| `sdk/src/mcp.ts` | MCP protocol client |
| `sdk/src/google.ts` | Google Workspace controller |
| `sdk/src/notion.ts` | Notion controller |
| `cli/package.json` | CLI package definition |
| `cli/src/index.ts` | CLI main entry |
| `cli/src/commands/*.ts` | CLI command implementations |
| `supabase/functions/opentuna-email-send/index.ts` | Email send edge function |
| `supabase/functions/opentuna-email-fetch/index.ts` | Email fetch edge function |
| `supabase/functions/opentuna-slack-post/index.ts` | Slack post edge function |
| `supabase/functions/opentuna-cron-execute/index.ts` | Cron executor |
| `supabase/functions/opentuna-mcp-execute/index.ts` | MCP proxy |

### Files to Update

| File | Changes |
|------|---------|
| `sdk/package.json` | Version 3.1.0, new exports |
| `sdk/README.md` | Complete rewrite with professional documentation |
| `sdk/src/index.ts` | Export all new controllers |
| `sdk/src/opentuna.ts` | Add email, slack, whatsapp, cron, mcp, google, notion controllers |
| `src/components/opentuna/OpenTunaIntegrations.tsx` | Add 6+ new active integrations |
| `src/components/opentuna/OpenTunaDocs.tsx` | Add documentation for new features |
| `public/TUNA_WHITEPAPER.md` | Comprehensive OpenTuna section update |

---

## Final SDK Usage Example

After implementation, users can:

```bash
npm install -g @opentuna/cli
npm install @opentuna/sdk

opentuna init
opentuna hatch --type general --name "OmniBot"
```

```typescript
import { OpenTuna } from '@opentuna/sdk';

const agent = new OpenTuna({ apiKey: 'ota_live_...' });

// Email automation
await agent.email.fetchInbox(10);
await agent.email.reply(messageId, 'Thanks for reaching out!');

// Slack integration
await agent.slack.postMessage('#alerts', 'New trade executed!');

// Scheduled tasks
await agent.cron.schedule('fin_trade', '0 9 * * *', { action: 'quote' });

// MCP tools (700+ community integrations)
await agent.mcp.execute('github-mcp', 'create_issue', { title: 'Bug' });

// Google Workspace
await agent.google.sheets.write(sheetId, 'A1:B10', data);

// All existing features still work
await agent.fins.trade({ action: 'buy', tokenMint: '...', amountSol: 0.1 });
await agent.fins.browse({ action: 'navigate', url: 'https://pump.fun' });
await agent.memory.store({ content: 'Trade completed', type: 'anchor' });
```

---

## Success Criteria

After implementation:
1. `npm install -g @opentuna/cli` works
2. `opentuna hatch` creates agents from terminal
3. Email, Slack, WhatsApp automation works
4. Cron scheduling works
5. MCP protocol connects to 700+ tools
6. Google Workspace / Notion integrations work
7. Full documentation in SDK README
8. Whitepaper updated with all features

This makes OpenTuna a **true OpenClaw alternative** with equal or better professional capabilities, plus native Solana trading that OpenClaw doesn't have.

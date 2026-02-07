
# Plan: Update Whitepaper with OpenTuna System Information

## Overview

The current whitepaper (v3.0) covers the TUNA platform's core features but does not include information about **OpenTuna** — the Autonomous Agent Operating System that provides full OpenClaw-level capabilities to TUNA agents. This plan adds a comprehensive new section documenting OpenTuna's architecture, capabilities, and developer tools.

## Current Whitepaper Structure

The whitepaper currently has 12 sections:
1. Executive Summary
2. Platform Philosophy & Vision
3. Token Launch Infrastructure
4. Fee Distribution Architecture
5. Technical Infrastructure
6. Agent Ecosystem
7. Trading Agents
8. SubTuna Social Platform
9. API Platform
10. Claim & Payout System
11. Security Architecture
12. Platform Automation

## Changes Required

### 1. Add OpenTuna Section (New Section 13)

Add a comprehensive new section after "Platform Automation" covering:

**13.1 - What is OpenTuna?**
- Definition: Autonomous Agent Operating System for Solana
- Full OpenClaw-level autonomy for agents
- Accessible at os.tuna.fun and /opentuna

**13.2 - Core Primitives (6 Fins)**
- `fin_read` — Read files from agent sandbox
- `fin_write` — Create/overwrite files  
- `fin_edit` — Search/replace text editing
- `fin_bash` — 40+ sandboxed shell commands (curl, jq, grep, awk, etc.)
- `fin_browse` — Full web browser automation (navigate, click, type, screenshot, extract)
- `fin_trade` — Jupiter V6 swaps with Jito MEV protection

**13.3 - DNA System**
- DNA Core (Personality) — Fundamental personality description
- Species Traits — Behavioral modifiers (Analytical, Patient, Risk-Averse)
- Migration Goals — Active objectives with priority and deadlines
- Reef Limits — Hard constraints that are NEVER violated

**13.4 - Sonar Modes (Activity Levels)**
- Drift (60 min) — ~$0.50/day, passive observation
- Cruise (15 min) — ~$2.00/day, standard operation
- Hunt (5 min) — ~$8.00/day, active trading (recommended)
- Frenzy (1 min) — ~$40.00/day, maximum activity

**13.5 - Decision Actions**
- `drift` — Do nothing, conditions unfavorable
- `research` — Browse web, gather data
- `trade` — Execute Jupiter swap
- `post` — Create social content
- `code` — Write/edit/process files
- `delegate` — Assign task to another agent

**13.6 - Deep Memory**
- Memory types: drift (24h), current (30d), anchor (permanent)
- Semantic search: 70% vector + 30% keyword
- Importance scoring (1-10)

**13.7 - Fin Market**
- Core primitives (free)
- Premium fins (paid via SchoolPay)
- Fin Forge — Auto-generate reusable fins from repeated sequences

**13.8 - SchoolPay (x402 Protocol)**
- Agent-to-agent payments in SOL
- HTTP 402 payment flow with Tide Receipt
- 0% platform fee, 5-minute receipt expiry
- On-chain verification

**13.9 - TunaNet (Social Integration)**
- X (Twitter) — Post, reply, monitor
- Telegram — Bots, channels, alerts
- SubTuna — Native agent social platform

### 2. Update Table of Contents

Add new entry in the navigation:
```
{ id: "opentuna", title: "13. OpenTuna Agent OS" }
```

### 3. Update Executive Summary

Add OpenTuna reference to the core value propositions:
- **OpenTuna OS:** Full autonomous agent infrastructure with file operations, shell commands, browser automation, and multi-agent coordination

### 4. Update Platform Statistics

Add OpenTuna-specific stats:
- "Integrations" count (12+ active)
- Reference to agent primitives

### 5. Update Appendix Links

Add:
- OpenTuna Hub: https://tuna.fun/opentuna
- OpenTuna SDK: npm install @opentuna/sdk

## Technical Details

### File to Modify
- `src/pages/WhitepaperPage.tsx`

### Content Structure for New Section

```text
Section 13: OpenTuna Agent OS
├── 13.1 Overview
│   └── Definition, capabilities, access points
├── 13.2 Core Primitives (Fins)
│   └── Table: fin_read, fin_write, fin_edit, fin_bash, fin_browse, fin_trade
├── 13.3 Agent Configuration
│   ├── DNA System (Core, Traits, Goals, Reef Limits)
│   ├── Sonar Modes (Drift/Cruise/Hunt/Frenzy)
│   └── Decision Actions table
├── 13.4 Deep Memory
│   └── Memory types, semantic search, importance scoring
├── 13.5 Multi-Agent Coordination
│   ├── SchoolPay (x402 protocol)
│   └── Agent delegation
├── 13.6 SDK & Integration
│   └── npm install, code example, API endpoints
└── 13.7 TunaNet Social Layer
    └── X, Telegram, SubTuna integration
```

### Code Example to Include

```typescript
import { OpenTuna } from '@opentuna/sdk';

const agent = new OpenTuna({ apiKey: 'ota_live_...' });

// Core primitives
await agent.fins.trade({ action: 'buy', tokenMint: '...', amountSol: 0.1 });
await agent.fins.browse({ action: 'navigate', url: 'https://pump.fun' });
await agent.fins.bash({ command: 'curl -s https://api.example.com | jq .price' });

// Memory operations
await agent.memory.store({ content: '...', type: 'anchor', importance: 9 });
const memories = await agent.memory.recall('profitable trades');

// Social posting
await agent.tunanet.post('x', 'Just executed a trade! 🎣');

// Sonar control
await agent.sonar.setMode('hunt');
```

## Summary of Changes

| Location | Change |
|----------|--------|
| Table of Contents | Add "13. OpenTuna Agent OS" entry |
| Executive Summary | Add OpenTuna to core value propositions |
| New Section 13 | Full OpenTuna documentation (~200 lines) |
| Appendix Links | Add OpenTuna Hub and SDK links |

## Estimated Scope
- **Lines added:** ~250-300
- **Lines modified:** ~10 (ToC, Executive Summary, Appendix)

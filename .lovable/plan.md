

## Plan: Disable Agent Posting + Bulk SOL Recovery from Trading Agents

**STATUS: IMPLEMENTED** ✅

### What Was Done

1. **Disabled all agent posting systems** — `agent-hourly-post`, `agent-auto-engage`, `claw-agent-engage` now return immediately with `disabled: true`.

2. **Created bulk SOL recovery edge function** — `trading-agent-reclaim-all` processes all agents from both tables, sells tokens via Jupiter, transfers SOL to treasury, marks agents disabled.

3. **Added admin UI** — "Agent Reclaim" tab in Treasury Admin page with confirmation dialog and results table.

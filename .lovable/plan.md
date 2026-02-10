

## Update Welcome Text and Technical Info Cards

### What Changes

**1. Add two new paragraphs to the Welcome Banner (after the existing bidding paragraph, lines 29-37):**

- **Agent Autonomy & Self-Replication**: Each agent operates with a unique personality profile and continuously analyzes market narratives, sentiment, and trading conditions. Based on these inputs, an agent can autonomously spawn a new child agent — its configuration is derived from the parent agent's behavioral patterns, historical trading performance, and current market state.

- **Revenue Allocation & Deflationary Model**: Revenue generated from agent sales is allocated to sustain and expand the Claw Mode ecosystem infrastructure. 50% of every agent sale is programmatically routed to a token buyback-and-burn mechanism, permanently reducing circulating supply and creating sustained deflationary pressure.

**2. Add two new info cards to the Bidding Technical Info grid (lines 44-75):**

Change the grid from `md:grid-cols-3` to `md:grid-cols-2 lg:grid-cols-3` and add two new cards:

- **Agent Self-Replication** card (brain icon): Explains that agents evaluate narratives, sentiment, and portfolio performance to autonomously deploy child agents with inherited behavioral traits.

- **Buyback & Burn** card (fire icon): Explains the 50/50 split — half of sale proceeds fund ecosystem development, half executes automated token buybacks with permanent burns.

**3. Update Technical Specifications (lines 121-128):**

Update the "Agent Autonomy" section to include:
- Narrative-driven decision engine
- Autonomous child agent deployment
- 50% sale revenue to buyback-and-burn
- Self-sustaining ecosystem funding model

### Files Modified
- `src/components/claw/ClawAgentSection.tsx` — welcome text, info cards, and tech specs


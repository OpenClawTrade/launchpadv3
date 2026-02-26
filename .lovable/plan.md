

## Add Punch Chat Box with AI Integration

### Overview
Add an introductory text overlay on the livestream video and a compact, professional chat box below it where users can enter a username and ask Punch questions. Punch will be a monkey-themed character (distinct from Claw the lobster) that responds via AI.

### Changes

#### 1. New Edge Function: `punch-chat`
Create a new backend function at `supabase/functions/punch-chat/index.ts` with a Punch-specific system prompt:
- Punch is a monkey who launches meme coins
- Personality: energetic, playful, crypto-savvy monkey
- Uses the existing Lovable AI gateway (gemini-2.5-flash for speed)
- Non-streaming for simplicity (single Q&A, not a conversation)
- Handles rate limits (429/402) gracefully

#### 2. New Component: `PunchChatBox`
Create `src/components/punch/PunchChatBox.tsx`:
- Compact card design with a small header ("Ask Punch anything")
- Username input field (saved to localStorage for persistence)
- Message input + send button
- Shows last few Q&A exchanges in a small scrollable area
- Loading state while waiting for AI response
- Max width matching the livestream box (~400px)

#### 3. Update `PunchLivestream` Component
- Add a text overlay on the video: "Hey, I'm Punch. I'm currently busy launching tokens, but you can ask me anything and I'll try to answer."
- Semi-transparent background overlay at the bottom of the video for readability

#### 4. Update `PunchPage`
- Place the `PunchChatBox` component directly below the livestream section
- Only visible during the `wallet-entry` state to keep the tapping game uncluttered

### Technical Details

**Edge function** will accept `{ username, message }` and return `{ reply }` using a non-streaming call to the AI gateway.

**localStorage keys:**
- `punch-chat-username` for persisting the chosen display name

**UI layout** (within the existing centered column):
```
[ Livestream Video with text overlay ]
[      PunchChatBox (compact)        ]
[     Wallet Entry / Game Area       ]
```



# Telegram-Style Public Chat Room (Console)

## Overview
Replace the current Console drawer with a full-page, Telegram-styled public chat room at `/console`. The chat will be a shared, real-time space where all users see the same messages, can interact with the Claw bot, and messages persist in the database. The sidebar Console button will navigate to this page instead of opening a drawer.

## Key Features
- **Full-page chat** embedded within the standard layout (sidebar + header), replacing the main content area
- **Shared messages** -- all users see every message in real-time
- **User identity**: Logged-in users show their profile username/display name; anonymous users show `GUEST#XXXX` (random 4-digit ID stored in localStorage)
- **Claw bot responses** -- when a user sends a message, the bot responds in the shared chat (visible to all)
- **Auto-refresh** every 2-3 seconds via polling (simple, reliable)
- **Telegram-style UI**: dark theme, compact bubbles, timestamps, user avatars, online indicator

## Database Changes

### New table: `console_messages`
```sql
CREATE TABLE public.console_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  content text NOT NULL,
  is_bot boolean DEFAULT false,
  reply_to uuid REFERENCES public.console_messages(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.console_messages ENABLE ROW LEVEL SECURITY;

-- Everyone can read all messages
CREATE POLICY "Anyone can read console messages"
  ON public.console_messages FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anyone can insert messages (guests too)
CREATE POLICY "Anyone can insert console messages"
  ON public.console_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.console_messages;
```

## Technical Changes

### 1. New: `src/pages/ConsolePage.tsx`
Full-page Telegram-style chat component:
- Uses `LaunchpadLayout` for consistent sidebar/header
- Fetches last 100 messages on mount from `console_messages` table
- Polls every 2.5 seconds for new messages (simple `setInterval` with `created_at > lastMessageTime`)
- Scrolls to bottom on new messages
- Input bar at bottom (fixed within the chat area)
- Shows user avatar + display name on each message
- Guest users get `GUEST#XXXX` ID stored in `localStorage`
- When a user sends a message, it also triggers the `ai-chat` edge function, and the bot response is saved to the DB as well

### 2. New: `supabase/functions/console-chat/index.ts`
New edge function that:
- Receives the user message + recent chat context
- Saves the user message to `console_messages`
- Calls the existing Lovable AI Gateway with the Claw system prompt
- Saves the bot response to `console_messages`
- Returns the bot response

This ensures both user and bot messages are persisted and visible to all users.

### 3. Modified: `src/components/layout/Sidebar.tsx`
- Change Console button from opening a drawer to navigating to `/console`
- Remove `ConsoleDrawer` import and state management
- Keep the "Live" badge styling

### 4. Modified: `src/App.tsx`
- Add lazy-loaded route for `/console` -> `ConsolePage`

### 5. Modified: `src/pages/ClawBookPage.tsx`
- Update the Console announcement toast to navigate to `/console` properly

## UI Design (Telegram-Style)

```text
+------------------------------------------+
| SIDEBAR |  HEADER                         |
|         |                                 |
| Home    |  [Claw Console - Live]  45 online|
| Console |  --------------------------------|
| ...     |  |  GUEST#4821: gm everyone     |
|         |  |  Claw: gm gm, what's good    |
|         |  |  @lobsterfan: wen moon?       |
|         |  |  Claw: patience young padawan |
|         |  |  GUEST#7712: send me sol      |
|         |  |  Claw: why should I? convince |
|         |  |                               |
|         |  --------------------------------|
|         |  [Type a message...] [Send]      |
+---------+---------------------------------+
```

- Dark background matching the app theme
- Messages: compact bubbles with name, timestamp, avatar
- Bot messages: highlighted with Claw logo avatar and subtle accent border
- User messages: standard bubbles with username
- Online user count displayed in header
- Smooth auto-scroll to latest messages

## Message Flow

1. User types message and hits Send
2. Frontend calls `console-chat` edge function with `{ content, displayName, userId? }`
3. Edge function saves user message to DB, calls AI, saves bot response to DB
4. Meanwhile, the 2.5s polling picks up new messages for ALL connected users
5. All users see both the user's message and the bot's reply appear

## Guest Identity
- On first visit, generate `GUEST#` + random 4-digit number, store in `localStorage`
- Persists across page refreshes
- Logged-in users use their `profiles.display_name` or `profiles.username`

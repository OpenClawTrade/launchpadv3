-- Governance Conversations and Suggestions
-- Table to store all AI chat conversations for governance

CREATE TABLE public.governance_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  wallet_address TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message_count INTEGER NOT NULL DEFAULT 0,
  is_holder BOOLEAN DEFAULT false
);

-- Table to store individual messages in conversations
CREATE TABLE public.governance_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.governance_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store flagged good suggestions
CREATE TABLE public.governance_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.governance_conversations(id),
  message_id UUID REFERENCES public.governance_messages(id),
  user_id UUID REFERENCES public.profiles(id),
  wallet_address TEXT,
  suggestion_text TEXT NOT NULL,
  category TEXT, -- 'feature', 'bug', 'improvement', 'other'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'implemented', 'rejected')),
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT
);

-- Enable RLS
ALTER TABLE public.governance_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for governance_conversations
-- Users can view their own conversations
CREATE POLICY "Users can view their own conversations" 
  ON public.governance_conversations 
  FOR SELECT 
  USING (user_id = auth.uid() OR wallet_address IS NOT NULL);

-- Anyone can insert a conversation (will be linked to wallet later)
CREATE POLICY "Anyone can create conversations" 
  ON public.governance_conversations 
  FOR INSERT 
  WITH CHECK (true);

-- RLS Policies for governance_messages
-- Messages are viewable if part of user's conversation
CREATE POLICY "Users can view messages in their conversations" 
  ON public.governance_messages 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.governance_conversations c 
      WHERE c.id = conversation_id 
      AND (c.user_id = auth.uid() OR c.wallet_address IS NOT NULL)
    )
  );

-- Anyone can insert messages
CREATE POLICY "Anyone can add messages" 
  ON public.governance_messages 
  FOR INSERT 
  WITH CHECK (true);

-- RLS Policies for governance_suggestions
-- Suggestions are publicly viewable
CREATE POLICY "Suggestions are publicly viewable" 
  ON public.governance_suggestions 
  FOR SELECT 
  USING (true);

-- Anyone can create suggestions
CREATE POLICY "Anyone can create suggestions" 
  ON public.governance_suggestions 
  FOR INSERT 
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_governance_messages_conversation ON public.governance_messages(conversation_id);
CREATE INDEX idx_governance_conversations_user ON public.governance_conversations(user_id);
CREATE INDEX idx_governance_conversations_wallet ON public.governance_conversations(wallet_address);
CREATE INDEX idx_governance_suggestions_status ON public.governance_suggestions(status);
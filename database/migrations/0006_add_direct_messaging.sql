-- Add Direct Messaging Tables and Policies

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Conversation Participants Table (Mapping Users to Conversations)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- 3. Direct Messages Table
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Turn on row level security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- Policies
-- --------------------------------------------------------

-- Conversations: A user can view a conversation if they are a participant.
CREATE POLICY "Users can view their own conversations"
ON public.conversations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = id AND user_id = auth.uid()
    )
);

-- Conversations: A user can create a conversation if they are on the team (simplified, any authed user can insert initially, team validation usually done at application level)
CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Conversations: Update timestamp
CREATE POLICY "Participants can update conversations"
ON public.conversations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = id AND user_id = auth.uid()
    )
);

-- Participants: Users can view participants of their conversations
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
    OR user_id = auth.uid()
);

-- Participants: Users can add themselves or others to conversations
CREATE POLICY "Users can insert participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Participants: Update last_read_at
CREATE POLICY "Users can update their own participant records"
ON public.conversation_participants FOR UPDATE
USING (user_id = auth.uid());

-- Messages: View messages in participated conversations
CREATE POLICY "Users can view messages in their conversations"
ON public.direct_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = direct_messages.conversation_id AND user_id = auth.uid()
    )
);

-- Messages: Send messages to participated conversations
CREATE POLICY "Users can send messages to their conversations"
ON public.direct_messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = direct_messages.conversation_id AND user_id = auth.uid()
    )
);

-- Messages: Edit own messages
CREATE POLICY "Users can update their own messages"
ON public.direct_messages FOR UPDATE
USING (sender_id = auth.uid());

-- Realtime Configuration
-- Expose these tables to Supabase Realtime so chat messages appear instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;

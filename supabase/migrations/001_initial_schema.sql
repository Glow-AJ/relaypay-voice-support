-- RelayPay Voice Support Agent — Initial Database Schema
-- Run this migration in Supabase SQL Editor or via MCP apply_migration

-- Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Conversations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('voice', 'text')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'escalated')),
  vapi_call_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- ─── Messages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  audio_url TEXT,
  transcript_confidence FLOAT,
  intent TEXT,
  action_taken TEXT CHECK (action_taken IN ('answered', 'clarified', 'escalated', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Knowledge Base ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fees', 'onboarding', 'payouts', 'invoicing', 'compliance', 'general', 'troubleshooting')),
  source TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Knowledge Embeddings (pgvector RAG) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Agents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'support' CHECK (role IN ('support', 'admin', 'supervisor')),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Escalations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('compliance', 'account', 'dispute', 'transaction', 'identity', 'other')),
  reason TEXT NOT NULL,
  call_booked BOOLEAN DEFAULT FALSE,
  appointment_time TIMESTAMPTZ,
  appointment_timezone TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  assigned_agent_id UUID REFERENCES agents(id),
  resolution_notes TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Intent Log (analytics) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  message_id UUID REFERENCES messages(id),
  intent TEXT,
  confidence FLOAT,
  rag_results_count INTEGER,
  action_taken TEXT,
  escalation_id UUID REFERENCES escalations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vector Similarity Search Function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings ke
  JOIN knowledge_base kb ON kb.id = ke.knowledge_base_id
  WHERE kb.is_active = TRUE
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── Performance Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_vector
  ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_escalations_status_created
  ON escalations (status, created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_session
  ON conversations (session_id);

-- ─── Row Level Security ────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_log ENABLE ROW LEVEL SECURITY;

-- Public policies (customer-facing)
CREATE POLICY "public_read_active_kb" ON knowledge_base FOR SELECT USING (is_active = TRUE);
CREATE POLICY "public_insert_conversations" ON conversations FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "public_select_conversations" ON conversations FOR SELECT USING (TRUE);
CREATE POLICY "public_update_conversations" ON conversations FOR UPDATE USING (TRUE);
CREATE POLICY "public_insert_messages" ON messages FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "public_select_messages" ON messages FOR SELECT USING (TRUE);
CREATE POLICY "public_insert_escalations" ON escalations FOR INSERT WITH CHECK (TRUE);

-- Service role (n8n backend) gets full access via service role key — bypasses RLS by default

-- ─── Real-time Publications ────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE escalations;

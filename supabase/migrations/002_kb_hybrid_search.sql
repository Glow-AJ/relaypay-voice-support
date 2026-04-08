-- Migration 002: KB Hybrid Search (RAG-first redesign)
-- Applied: 2026-04-08
-- Purpose: Extends KB tables for chunked embeddings, FTS hybrid search,
--          SHA-256 deduplication, and embedding status tracking.

-- ─── 1. Extend knowledge_base ───────────────────────────────────────────────
ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'file'
    CHECK (source_type IN ('file', 'url')),
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'complete', 'failed')),
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;

-- ─── 2. Extend knowledge_embeddings ─────────────────────────────────────────
ALTER TABLE knowledge_embeddings
  ADD COLUMN IF NOT EXISTS chunk_text TEXT,
  ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;

-- Auto-generated FTS vector (Postgres maintains this automatically)
ALTER TABLE knowledge_embeddings
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(chunk_text, ''))) STORED;

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────
-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_fts
  ON knowledge_embeddings USING gin(fts);

-- Chunk ordering index
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_kb_chunk
  ON knowledge_embeddings (knowledge_base_id, chunk_index);

-- ─── 4. Hybrid search function (vector + FTS via Reciprocal Rank Fusion) ────
CREATE OR REPLACE FUNCTION hybrid_search_knowledge(
  query_embedding vector(1536),
  query_text TEXT,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  chunk_text TEXT,
  category TEXT,
  similarity FLOAT,
  rrf_score FLOAT
)
LANGUAGE sql STABLE AS $$
WITH
  vector_matches AS (
    SELECT ke.id,
           ke.knowledge_base_id,
           ke.chunk_text,
           1 - (ke.embedding <=> query_embedding) AS similarity,
           ROW_NUMBER() OVER (ORDER BY ke.embedding <=> query_embedding) AS v_rank
    FROM knowledge_embeddings ke
    JOIN knowledge_base kb ON kb.id = ke.knowledge_base_id
    WHERE kb.is_active = TRUE
      AND kb.embedding_status = 'complete'
      AND 1 - (ke.embedding <=> query_embedding) > match_threshold
    LIMIT match_count * 3
  ),
  fts_matches AS (
    SELECT ke.id,
           ke.knowledge_base_id,
           ke.chunk_text,
           0::FLOAT AS similarity,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank(ke.fts, plainto_tsquery('english', query_text)) DESC
           ) AS f_rank
    FROM knowledge_embeddings ke
    JOIN knowledge_base kb ON kb.id = ke.knowledge_base_id
    WHERE kb.is_active = TRUE
      AND kb.embedding_status = 'complete'
      AND ke.fts @@ plainto_tsquery('english', query_text)
    LIMIT match_count * 3
  ),
  rrf AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v.knowledge_base_id, f.knowledge_base_id) AS knowledge_base_id,
      COALESCE(v.chunk_text, f.chunk_text) AS chunk_text,
      COALESCE(v.similarity, 0) AS similarity,
      COALESCE(1.0 / (60 + v.v_rank), 0) + COALESCE(1.0 / (60 + f.f_rank), 0) AS rrf_score
    FROM vector_matches v
    FULL OUTER JOIN fts_matches f ON v.id = f.id
  )
SELECT kb.id, kb.title, kb.content, r.chunk_text, kb.category, r.similarity, r.rrf_score
FROM rrf r
JOIN knowledge_base kb ON kb.id = r.knowledge_base_id
ORDER BY r.rrf_score DESC
LIMIT match_count;
$$;

-- ─── 5. Enable real-time on knowledge_base ───────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE knowledge_base;

-- ─── 6. RLS policies ─────────────────────────────────────────────────────────
-- Service role (used by n8n) bypasses RLS automatically.
-- These allow authenticated admin portal users to manage KB via anon key.
DO $$ BEGIN
  CREATE POLICY "admin_full_kb" ON knowledge_base FOR ALL USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "admin_full_embeddings" ON knowledge_embeddings FOR ALL USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

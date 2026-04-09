-- Migration 007: Update hybrid_search_knowledge to join via metadata JSONB
-- Applied: 2026-04-09
-- Reason: n8n LangChain Supabase Vector Store stores knowledge_base_id in the
--         metadata JSONB column (not the direct knowledge_base_id column).
--         COALESCE handles both old records (direct column) and n8n records (metadata).

CREATE OR REPLACE FUNCTION hybrid_search_knowledge(
  query_embedding vector(1536),
  query_text TEXT,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID, title TEXT, content TEXT, chunk_text TEXT,
  category TEXT, similarity FLOAT, rrf_score FLOAT
)
LANGUAGE sql STABLE AS $$
WITH
  vector_matches AS (
    SELECT ke.id,
           COALESCE(ke.knowledge_base_id, (ke.metadata->>'knowledge_base_id')::uuid) AS kb_id,
           ke.chunk_text,
           1 - (ke.embedding <=> query_embedding) AS similarity,
           ROW_NUMBER() OVER (ORDER BY ke.embedding <=> query_embedding) AS v_rank
    FROM knowledge_embeddings ke
    WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
      AND EXISTS (
        SELECT 1 FROM knowledge_base kb
        WHERE kb.id = COALESCE(ke.knowledge_base_id, (ke.metadata->>'knowledge_base_id')::uuid)
          AND kb.is_active = TRUE
          AND kb.embedding_status = 'complete'
      )
    LIMIT match_count * 3
  ),
  fts_matches AS (
    SELECT ke.id,
           COALESCE(ke.knowledge_base_id, (ke.metadata->>'knowledge_base_id')::uuid) AS kb_id,
           ke.chunk_text,
           0::FLOAT AS similarity,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank(ke.fts, plainto_tsquery('english', query_text)) DESC
           ) AS f_rank
    FROM knowledge_embeddings ke
    WHERE ke.fts @@ plainto_tsquery('english', query_text)
      AND EXISTS (
        SELECT 1 FROM knowledge_base kb
        WHERE kb.id = COALESCE(ke.knowledge_base_id, (ke.metadata->>'knowledge_base_id')::uuid)
          AND kb.is_active = TRUE
          AND kb.embedding_status = 'complete'
      )
    LIMIT match_count * 3
  ),
  rrf AS (
    SELECT COALESCE(v.id, f.id) AS id,
           COALESCE(v.kb_id, f.kb_id) AS kb_id,
           COALESCE(v.chunk_text, f.chunk_text) AS chunk_text,
           COALESCE(v.similarity, 0) AS similarity,
           COALESCE(1.0/(60 + v.v_rank), 0) + COALESCE(1.0/(60 + f.f_rank), 0) AS rrf_score
    FROM vector_matches v FULL OUTER JOIN fts_matches f ON v.id = f.id
  )
SELECT kb.id, kb.title, kb.content, r.chunk_text, kb.category, r.similarity, r.rrf_score
FROM rrf r
JOIN knowledge_base kb ON kb.id = r.kb_id
ORDER BY r.rrf_score DESC
LIMIT match_count;
$$;

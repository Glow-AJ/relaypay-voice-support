-- Migration 005: Add metadata JSONB to knowledge_embeddings
-- Applied: 2026-04-09
-- Purpose: Chunk-level metadata n8n can populate during ingestion.
--          Examples: { "page": 3, "section": "Fees & Pricing", "heading": "..." }
--          Returned alongside chunk_text in hybrid search results for richer GPT context.

ALTER TABLE knowledge_embeddings
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

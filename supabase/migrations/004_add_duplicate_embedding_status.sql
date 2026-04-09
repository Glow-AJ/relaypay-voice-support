-- Migration 004: Add 'duplicate' to embedding_status CHECK constraint
-- Applied: 2026-04-09
-- Reason: n8n sets status='duplicate' when uploaded content matches an existing
--         file hash. Frontend auto-deletes the duplicate row after 3 seconds
--         and shows a toast to the admin.

ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_embedding_status_check;
ALTER TABLE knowledge_base ADD CONSTRAINT knowledge_base_embedding_status_check
  CHECK (embedding_status IN ('pending', 'processing', 'complete', 'failed', 'duplicate'));

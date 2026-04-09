-- Migration 006: Add error_details to knowledge_base
-- Applied: 2026-04-09
-- Purpose: When embedding_status='failed', n8n writes the reason here.
--          Admin sees it in the preview panel. No separate error log table needed.

ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS error_details TEXT;

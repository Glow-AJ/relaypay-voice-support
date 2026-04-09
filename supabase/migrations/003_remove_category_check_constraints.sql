-- Migration 003: Remove hardcoded CHECK constraint on knowledge_base.category
-- Applied: 2026-04-08
-- Reason: KB category is now a free-text field — any value allowed,
--         not limited to the original 7 predefined options.

ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_category_check;

-- Action module v2: comments system, overdue status in dictionary
-- Run after add_action_enhancements.sql

-- ═══════════════════ ACTION_COMMENTS TABLE ═══════════════════

CREATE TABLE IF NOT EXISTS action_comments (
    id SERIAL PRIMARY KEY,
    action_id INTEGER NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    author VARCHAR(200),
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_comments_action_id ON action_comments(action_id);

-- ═══════════════════ OVERDUE STATUS IN DICTIONARY ═══════════════════
-- Add 'overdue' entry to action_status dictionary (needed for auto-overdue feature)
-- This INSERT uses a subquery to get the dict_type_id for 'action_status'

INSERT INTO dictionary_entries (dict_type_id, code, label, description, sort_order, is_active)
SELECT dt.id, 'overdue', 'Przeterminowane', 'Automatycznie oznaczone po przekroczeniu terminu realizacji', 90, TRUE
FROM dictionary_types dt
WHERE dt.code = 'action_status'
  AND NOT EXISTS (
    SELECT 1 FROM dictionary_entries de
    WHERE de.dict_type_id = dt.id AND de.code = 'overdue'
  );

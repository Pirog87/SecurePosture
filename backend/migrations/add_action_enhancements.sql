-- Action enhancements: change_reason in history, attachments, implementation_notes
-- Run after add_actions_table.sql

-- Add change_reason column to action_history
ALTER TABLE action_history ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- Add implementation_notes to actions
ALTER TABLE actions ADD COLUMN IF NOT EXISTS implementation_notes TEXT;

-- Create action_attachments table
CREATE TABLE IF NOT EXISTS action_attachments (
    id SERIAL PRIMARY KEY,
    action_id INTEGER NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    content_type VARCHAR(200),
    uploaded_by VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_attachments_action_id ON action_attachments(action_id);

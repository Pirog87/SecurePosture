-- ============================================================
-- Migration 018: Framework Node AI Cache
-- Tabela cache dla wyników AI (interpretacja, tłumaczenie, dowody)
-- ============================================================

CREATE TABLE IF NOT EXISTS framework_node_ai_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    node_id INT NOT NULL,
    action_type VARCHAR(20) NOT NULL COMMENT 'interpret, translate, evidence',
    language VARCHAR(10) NULL COMMENT 'Kod jezyka docelowego (np. pl, en), NULL dla interpret/evidence',
    result_json JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_cache_node FOREIGN KEY (node_id) REFERENCES framework_nodes(id) ON DELETE CASCADE,
    CONSTRAINT uq_node_ai_cache UNIQUE (node_id, action_type, language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_node_ai_cache_node ON framework_node_ai_cache (node_id);
CREATE INDEX ix_node_ai_cache_action ON framework_node_ai_cache (node_id, action_type);

-- Actions module migration
-- Run this on MariaDB to create actions tables and dictionary entries

CREATE TABLE IF NOT EXISTS actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    org_unit_id INT NULL,
    owner VARCHAR(200) NULL,
    responsible VARCHAR(200) NULL,
    priority_id INT NULL,
    status_id INT NULL,
    source_id INT NULL,
    due_date DATETIME NULL,
    completed_at DATETIME NULL,
    effectiveness_rating INT NULL,
    effectiveness_notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    FOREIGN KEY (priority_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (status_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (source_id) REFERENCES dictionary_entries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS action_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action_id INT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE,
    INDEX idx_action_links_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS action_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action_id INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    changed_by VARCHAR(200) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE,
    INDEX idx_action_history_action (action_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asset relationships table
CREATE TABLE IF NOT EXISTS asset_relationships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_asset_id INT NOT NULL,
    target_asset_id INT NOT NULL,
    relationship_type VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (target_asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset_rel_source (source_asset_id),
    INDEX idx_asset_rel_target (target_asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

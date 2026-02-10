-- Asset Registry module migration
-- Run this on MariaDB to create the assets table and link risks to assets

CREATE TABLE IF NOT EXISTS assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(400) NOT NULL,
    asset_type_id INT NULL,
    category_id INT NULL,
    org_unit_id INT NULL,
    parent_id INT NULL,
    owner VARCHAR(200) NULL,
    description TEXT NULL,
    location VARCHAR(300) NULL,
    sensitivity_id INT NULL,
    criticality_id INT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_type_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (category_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (org_unit_id) REFERENCES org_units(id),
    FOREIGN KEY (parent_id) REFERENCES assets(id),
    FOREIGN KEY (sensitivity_id) REFERENCES dictionary_entries(id),
    FOREIGN KEY (criticality_id) REFERENCES dictionary_entries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add asset_id FK to risks table (optional link to registered asset)
ALTER TABLE risks ADD COLUMN asset_id INT NULL AFTER org_unit_id;
ALTER TABLE risks ADD CONSTRAINT fk_risks_asset_id FOREIGN KEY (asset_id) REFERENCES assets(id);

-- Add dictionary type for asset types (Primary, Support, Infrastructure)
INSERT IGNORE INTO dictionary_types (code, name, description, is_system, created_at, updated_at)
VALUES ('asset_type', 'Typ aktywa', 'Klasyfikacja typu aktywa (Primary, Support, Infrastructure)', FALSE, NOW(), NOW());

-- Add default asset type entries
SET @asset_type_id = (SELECT id FROM dictionary_types WHERE code = 'asset_type');

INSERT IGNORE INTO dictionary_entries (dict_type_id, code, label, description, numeric_value, sort_order, is_active, created_at, updated_at)
VALUES
    (@asset_type_id, 'primary', 'Podstawowy', 'Aktywa bezpośrednio wspierające procesy biznesowe', 1, 1, TRUE, NOW(), NOW()),
    (@asset_type_id, 'support', 'Wspierający', 'Aktywa wspierające inne aktywa (infrastruktura IT)', 2, 2, TRUE, NOW(), NOW()),
    (@asset_type_id, 'infrastructure', 'Infrastruktura', 'Aktywa infrastrukturalne (budynki, sieć)', 3, 3, TRUE, NOW(), NOW());

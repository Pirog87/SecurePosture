-- Add target W/P/Z columns for residual risk calculation
-- Run this on MariaDB

ALTER TABLE risks ADD COLUMN target_impact INT NULL AFTER residual_risk;
ALTER TABLE risks ADD COLUMN target_probability INT NULL AFTER target_impact;
ALTER TABLE risks ADD COLUMN target_safeguard DECIMAL(4,2) NULL AFTER target_probability;

-- Migration 011: Add it_coordinator field to org_units
-- Run this SQL to add the Koordynator IT field

ALTER TABLE org_units ADD COLUMN IF NOT EXISTS it_coordinator VARCHAR(200) DEFAULT NULL;

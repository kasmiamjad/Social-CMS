-- Add product_images JSONB column to whatsapp_automation_configs.
-- Stores a map of product slug → public image URL.
-- e.g. { "dispenser": "https://...", "ro_699": "https://..." }
ALTER TABLE whatsapp_automation_configs
ADD COLUMN IF NOT EXISTS product_images JSONB DEFAULT '{}'::jsonb;

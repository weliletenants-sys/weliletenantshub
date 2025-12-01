-- CRITICAL SECURITY: Enforce Transaction ID (TID) as mandatory for all payments
-- This prevents data integrity issues and ensures every payment has trackable TID

-- First, check if there are any existing records without payment_id and update them with placeholder
UPDATE collections 
SET payment_id = 'LEGACY-' || id::text
WHERE payment_id IS NULL OR payment_id = '';

-- Add NOT NULL constraint to payment_id column
ALTER TABLE collections 
ALTER COLUMN payment_id SET NOT NULL;

-- Add constraint to prevent empty strings
ALTER TABLE collections 
ADD CONSTRAINT payment_id_not_empty CHECK (length(trim(payment_id)) > 0);

-- Create index on payment_id for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_collections_payment_id ON collections(payment_id);

-- Add comment explaining the mandatory nature
COMMENT ON COLUMN collections.payment_id IS 'Transaction ID (TID) - MANDATORY for all payments. Must be unique and non-empty for audit trail and duplicate prevention.';
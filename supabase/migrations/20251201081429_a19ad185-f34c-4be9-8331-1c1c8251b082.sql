-- Add payment_id field and update collection_date to support exact timestamps
ALTER TABLE collections 
ADD COLUMN payment_id TEXT;

-- Update collection_date to timestamp with time zone to store exact payment time
ALTER TABLE collections 
ALTER COLUMN collection_date TYPE timestamp with time zone 
USING collection_date::timestamp with time zone;

-- Update default to include timestamp
ALTER TABLE collections 
ALTER COLUMN collection_date SET DEFAULT now();

COMMENT ON COLUMN collections.payment_id IS 'Custom payment identifier entered by agent/manager for tracking';
COMMENT ON COLUMN collections.collection_date IS 'Exact date and time when payment was made';
-- Make non-essential tenant fields nullable to allow partial data entry
ALTER TABLE public.tenants 
  ALTER COLUMN landlord_name DROP NOT NULL,
  ALTER COLUMN landlord_phone DROP NOT NULL,
  ALTER COLUMN lc1_name DROP NOT NULL,
  ALTER COLUMN lc1_phone DROP NOT NULL,
  ALTER COLUMN rent_amount DROP NOT NULL,
  ALTER COLUMN registration_fee DROP NOT NULL;

-- Set default values for fields that should have them
ALTER TABLE public.tenants 
  ALTER COLUMN landlord_name SET DEFAULT '',
  ALTER COLUMN landlord_phone SET DEFAULT '',
  ALTER COLUMN lc1_name SET DEFAULT '',
  ALTER COLUMN lc1_phone SET DEFAULT '',
  ALTER COLUMN rent_amount SET DEFAULT 0,
  ALTER COLUMN registration_fee SET DEFAULT 0;
-- Add start_date and due_date columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS due_date date,
ADD COLUMN IF NOT EXISTS daily_payment_amount numeric;
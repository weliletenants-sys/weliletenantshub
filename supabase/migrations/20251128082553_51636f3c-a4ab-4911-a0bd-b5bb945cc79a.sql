-- Add payment-related fields to notifications table
ALTER TABLE public.notifications
ADD COLUMN payment_data jsonb DEFAULT NULL;

-- Add comment explaining the payment_data structure
COMMENT ON COLUMN public.notifications.payment_data IS 'JSON structure: { tenant_id, tenant_name, amount, payment_method, payment_date, applied }';

-- Create index for payment notifications
CREATE INDEX idx_notifications_payment_data ON public.notifications USING gin(payment_data) WHERE payment_data IS NOT NULL;
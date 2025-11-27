-- Create audit log table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Managers and admins can view audit logs
CREATE POLICY "Managers can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create function to log tenant changes
CREATE OR REPLACE FUNCTION public.log_tenant_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  changed_fields TEXT[] := ARRAY[]::TEXT[];
  field_name TEXT;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Only log if user is a manager or admin
  IF NOT (has_role(current_user_id, 'manager'::app_role) OR has_role(current_user_id, 'admin'::app_role)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- For UPDATE operations, track which fields changed
  IF TG_OP = 'UPDATE' THEN
    -- Compare old and new values to find changed fields
    IF OLD.tenant_name IS DISTINCT FROM NEW.tenant_name THEN
      changed_fields := array_append(changed_fields, 'tenant_name');
    END IF;
    IF OLD.tenant_phone IS DISTINCT FROM NEW.tenant_phone THEN
      changed_fields := array_append(changed_fields, 'tenant_phone');
    END IF;
    IF OLD.landlord_name IS DISTINCT FROM NEW.landlord_name THEN
      changed_fields := array_append(changed_fields, 'landlord_name');
    END IF;
    IF OLD.landlord_phone IS DISTINCT FROM NEW.landlord_phone THEN
      changed_fields := array_append(changed_fields, 'landlord_phone');
    END IF;
    IF OLD.lc1_name IS DISTINCT FROM NEW.lc1_name THEN
      changed_fields := array_append(changed_fields, 'lc1_name');
    END IF;
    IF OLD.lc1_phone IS DISTINCT FROM NEW.lc1_phone THEN
      changed_fields := array_append(changed_fields, 'lc1_phone');
    END IF;
    IF OLD.rent_amount IS DISTINCT FROM NEW.rent_amount THEN
      changed_fields := array_append(changed_fields, 'rent_amount');
    END IF;
    IF OLD.outstanding_balance IS DISTINCT FROM NEW.outstanding_balance THEN
      changed_fields := array_append(changed_fields, 'outstanding_balance');
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      changed_fields := array_append(changed_fields, 'status');
    END IF;
    IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
      changed_fields := array_append(changed_fields, 'start_date');
    END IF;
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
      changed_fields := array_append(changed_fields, 'due_date');
    END IF;
    IF OLD.daily_payment_amount IS DISTINCT FROM NEW.daily_payment_amount THEN
      changed_fields := array_append(changed_fields, 'daily_payment_amount');
    END IF;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    changed_fields
  ) VALUES (
    current_user_id,
    TG_OP,
    'tenants',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    changed_fields
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for tenant audit logging
CREATE TRIGGER tenant_audit_update
AFTER UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.log_tenant_audit();

CREATE TRIGGER tenant_audit_delete
AFTER DELETE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.log_tenant_audit();

-- Create index for faster audit log queries
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
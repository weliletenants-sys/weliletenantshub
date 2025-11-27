-- Add RLS policies for managers to update agents
CREATE POLICY "Managers can update agents"
ON public.agents
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create audit logging function for agent updates
CREATE OR REPLACE FUNCTION public.log_agent_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id UUID;
  changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  current_user_id := auth.uid();
  
  -- Only log if user is a manager or admin
  IF NOT (has_role(current_user_id, 'manager'::app_role) OR has_role(current_user_id, 'admin'::app_role)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- For UPDATE operations, track which fields changed
  IF TG_OP = 'UPDATE' THEN
    IF OLD.portfolio_value IS DISTINCT FROM NEW.portfolio_value THEN
      changed_fields := array_append(changed_fields, 'portfolio_value');
    END IF;
    IF OLD.portfolio_limit IS DISTINCT FROM NEW.portfolio_limit THEN
      changed_fields := array_append(changed_fields, 'portfolio_limit');
    END IF;
    IF OLD.total_tenants IS DISTINCT FROM NEW.total_tenants THEN
      changed_fields := array_append(changed_fields, 'total_tenants');
    END IF;
    IF OLD.active_tenants IS DISTINCT FROM NEW.active_tenants THEN
      changed_fields := array_append(changed_fields, 'active_tenants');
    END IF;
    IF OLD.monthly_earnings IS DISTINCT FROM NEW.monthly_earnings THEN
      changed_fields := array_append(changed_fields, 'monthly_earnings');
    END IF;
    IF OLD.collection_rate IS DISTINCT FROM NEW.collection_rate THEN
      changed_fields := array_append(changed_fields, 'collection_rate');
    END IF;
    IF OLD.motorcycle_eligible IS DISTINCT FROM NEW.motorcycle_eligible THEN
      changed_fields := array_append(changed_fields, 'motorcycle_eligible');
    END IF;
    IF OLD.motorcycle_applied IS DISTINCT FROM NEW.motorcycle_applied THEN
      changed_fields := array_append(changed_fields, 'motorcycle_applied');
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
    'agents',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    changed_fields
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for agent audit logging
CREATE TRIGGER audit_agent_changes
AFTER INSERT OR UPDATE OR DELETE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.log_agent_audit();

-- Enhance profile audit logging function
CREATE OR REPLACE FUNCTION public.log_profile_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id UUID;
  changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  current_user_id := auth.uid();
  
  -- Only log if user is a manager or admin editing another user's profile
  IF current_user_id != COALESCE(NEW.id, OLD.id) AND 
     (has_role(current_user_id, 'manager'::app_role) OR has_role(current_user_id, 'admin'::app_role)) THEN
    
    -- For UPDATE operations, track which fields changed
    IF TG_OP = 'UPDATE' THEN
      IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
        changed_fields := array_append(changed_fields, 'full_name');
      END IF;
      IF OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
        changed_fields := array_append(changed_fields, 'phone_number');
      END IF;
      IF OLD.role IS DISTINCT FROM NEW.role THEN
        changed_fields := array_append(changed_fields, 'role');
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
      'profiles',
      COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
      changed_fields
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for profile audit logging
CREATE TRIGGER audit_profile_changes
AFTER UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_audit();
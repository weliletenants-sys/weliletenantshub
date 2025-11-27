-- Update collections table to support payment verification workflow
-- Add verification status tracking and manager verification fields

-- Add verified_by and verified_at columns to track who verified the payment
ALTER TABLE public.collections
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Update status field to have clear verification states
-- Status can be: 'pending', 'verified', 'rejected'
-- Default new payments to 'pending' status

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Managers can update collection status" ON public.collections;

-- Create RLS policy to allow managers to update collection status
CREATE POLICY "Managers can update collection status"
ON public.collections
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries on verification status
CREATE INDEX IF NOT EXISTS idx_collections_status ON public.collections(status);
CREATE INDEX IF NOT EXISTS idx_collections_verified_by ON public.collections(verified_by);

-- Add trigger to log collection verification actions in audit log
CREATE OR REPLACE FUNCTION public.log_collection_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Only log verification actions by managers
  IF NOT (has_role(current_user_id, 'manager'::app_role) OR has_role(current_user_id, 'admin'::app_role)) THEN
    RETURN NEW;
  END IF;
  
  -- Log when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
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
      'UPDATE',
      'collections',
      NEW.id,
      jsonb_build_object('status', OLD.status, 'verified_at', OLD.verified_at),
      jsonb_build_object('status', NEW.status, 'verified_at', NEW.verified_at, 'verified_by', NEW.verified_by),
      ARRAY['status', 'verified_at', 'verified_by']
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collection_verification_audit ON public.collections;

CREATE TRIGGER collection_verification_audit
AFTER UPDATE ON public.collections
FOR EACH ROW
EXECUTE FUNCTION public.log_collection_verification();
-- Add RLS policy to allow managers to insert collections for any tenant
-- This enables managers to record payments on behalf of agents

CREATE POLICY "Managers can insert collections for any tenant"
ON public.collections
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add comment for documentation
COMMENT ON POLICY "Managers can insert collections for any tenant" ON public.collections 
IS 'Allows managers and admins to record payments for any tenant across all agents';
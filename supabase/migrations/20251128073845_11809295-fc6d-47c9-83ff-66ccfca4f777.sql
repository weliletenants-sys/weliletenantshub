-- Add DELETE policy for agents table to allow managers to delete agents
CREATE POLICY "Managers can delete agents"
ON public.agents
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);
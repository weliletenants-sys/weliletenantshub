-- Add policy for managers to view all profiles
CREATE POLICY "Managers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));

-- Ensure managers can view all agent data (update existing policy if needed)
DROP POLICY IF EXISTS "Managers can view all agents" ON public.agents;
CREATE POLICY "Managers can view all agents"
ON public.agents
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
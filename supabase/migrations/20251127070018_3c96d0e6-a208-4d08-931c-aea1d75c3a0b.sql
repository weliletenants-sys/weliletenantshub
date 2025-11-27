-- Allow agents to update their own tenants' outstanding balance
CREATE POLICY "Agents can update own tenants"
ON public.tenants
FOR UPDATE
USING (agent_id IN (
  SELECT id FROM agents WHERE user_id = auth.uid()
))
WITH CHECK (agent_id IN (
  SELECT id FROM agents WHERE user_id = auth.uid()
));
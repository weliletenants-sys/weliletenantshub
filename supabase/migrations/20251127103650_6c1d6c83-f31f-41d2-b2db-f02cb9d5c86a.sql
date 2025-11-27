-- Allow agents to delete their own tenants
CREATE POLICY "Agents can delete own tenants"
ON public.tenants
FOR DELETE
USING (
  agent_id IN (
    SELECT id 
    FROM agents 
    WHERE user_id = auth.uid()
  )
);
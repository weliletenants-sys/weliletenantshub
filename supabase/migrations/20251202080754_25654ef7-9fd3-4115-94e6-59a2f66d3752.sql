-- Add RLS policy to allow agents to delete their own collections
-- This is required so agents can delete tenants (which requires deleting associated collections first)
CREATE POLICY "Agents can delete own collections"
ON public.collections
FOR DELETE
TO authenticated
USING (
  agent_id IN (
    SELECT agents.id
    FROM agents
    WHERE agents.user_id = auth.uid()
  )
);
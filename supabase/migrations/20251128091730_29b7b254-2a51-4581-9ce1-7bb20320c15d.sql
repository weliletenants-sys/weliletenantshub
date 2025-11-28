-- Allow agents to send reply notifications back to managers
CREATE POLICY "Agents can send reply notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM agents 
    WHERE agents.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = recipient_id 
    AND profiles.role = 'manager'
  )
);
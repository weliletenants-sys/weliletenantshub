-- Update RLS policy to allow all agents to see payment notifications
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;

-- Create new policy that allows:
-- 1. Users to see their own notifications
-- 2. ALL agents to see payment notifications (payment_data is not null)
CREATE POLICY "Users can view notifications" 
ON notifications 
FOR SELECT 
USING (
  recipient_id = auth.uid() 
  OR 
  (
    payment_data IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM agents WHERE agents.user_id = auth.uid()
    )
  )
);
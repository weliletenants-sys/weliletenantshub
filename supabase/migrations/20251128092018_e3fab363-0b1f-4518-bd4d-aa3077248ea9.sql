-- Add parent notification tracking for threading
ALTER TABLE public.notifications
ADD COLUMN parent_notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE;

-- Create index for efficient thread queries
CREATE INDEX idx_notifications_parent_id ON public.notifications(parent_notification_id);

-- Add helper function to get full thread
CREATE OR REPLACE FUNCTION public.get_notification_thread(notification_id UUID)
RETURNS TABLE (
  id UUID,
  sender_id UUID,
  recipient_id UUID,
  title TEXT,
  message TEXT,
  priority TEXT,
  read BOOLEAN,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  parent_notification_id UUID,
  sender_name TEXT,
  is_reply BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  root_id UUID;
BEGIN
  -- Find the root notification (the one with no parent)
  WITH RECURSIVE thread_tree AS (
    -- Start with the given notification
    SELECT n.id, n.parent_notification_id
    FROM notifications n
    WHERE n.id = notification_id
    
    UNION
    
    -- Recursively find parent
    SELECT n.id, n.parent_notification_id
    FROM notifications n
    INNER JOIN thread_tree t ON n.id = t.parent_notification_id
  )
  SELECT thread_tree.id INTO root_id
  FROM thread_tree
  WHERE parent_notification_id IS NULL
  LIMIT 1;
  
  -- Return all messages in the thread, starting from root
  RETURN QUERY
  WITH RECURSIVE thread_messages AS (
    -- Start with root message
    SELECT 
      n.id,
      n.sender_id,
      n.recipient_id,
      n.title,
      n.message,
      n.priority,
      n.read,
      n.read_at,
      n.created_at,
      n.parent_notification_id,
      p.full_name as sender_name,
      (n.parent_notification_id IS NOT NULL) as is_reply
    FROM notifications n
    LEFT JOIN profiles p ON n.sender_id = p.id
    WHERE n.id = root_id
    
    UNION ALL
    
    -- Recursively get all replies
    SELECT 
      n.id,
      n.sender_id,
      n.recipient_id,
      n.title,
      n.message,
      n.priority,
      n.read,
      n.read_at,
      n.created_at,
      n.parent_notification_id,
      p.full_name as sender_name,
      (n.parent_notification_id IS NOT NULL) as is_reply
    FROM notifications n
    LEFT JOIN profiles p ON n.sender_id = p.id
    INNER JOIN thread_messages tm ON n.parent_notification_id = tm.id
  )
  SELECT * FROM thread_messages
  ORDER BY created_at ASC;
END;
$$;
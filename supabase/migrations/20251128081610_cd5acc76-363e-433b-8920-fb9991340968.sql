-- Add read_at timestamp to notifications table
ALTER TABLE public.notifications ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;

-- Create function to update read_at when notification is marked as read
CREATE OR REPLACE FUNCTION public.update_notification_read_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If read status changes from false to true, set read_at
  IF NEW.read = true AND (OLD.read = false OR OLD.read IS NULL) THEN
    NEW.read_at = now();
  END IF;
  
  -- If read status changes from true to false, clear read_at
  IF NEW.read = false AND OLD.read = true THEN
    NEW.read_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update read_at timestamp
CREATE TRIGGER trigger_update_notification_read_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_read_at();
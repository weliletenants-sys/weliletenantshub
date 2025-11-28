-- Create notifications table for in-app messages
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

-- Policies: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Policies: Managers can send notifications
CREATE POLICY "Managers can send notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Policies: Managers can view all notifications they sent
CREATE POLICY "Managers can view sent notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Create index for performance
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_sender ON public.notifications(sender_id, created_at DESC);

-- Update trigger for updated_at
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
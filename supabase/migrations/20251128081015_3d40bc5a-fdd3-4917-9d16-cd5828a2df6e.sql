-- Create message_drafts table for managers to save incomplete messages
CREATE TABLE public.message_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  draft_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  send_to_all BOOLEAN NOT NULL DEFAULT false,
  selected_agent_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;

-- Managers can view their own drafts
CREATE POLICY "Managers can view own drafts"
ON public.message_drafts
FOR SELECT
TO authenticated
USING (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Managers can insert their own drafts
CREATE POLICY "Managers can insert own drafts"
ON public.message_drafts
FOR INSERT
TO authenticated
WITH CHECK (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Managers can update their own drafts
CREATE POLICY "Managers can update own drafts"
ON public.message_drafts
FOR UPDATE
TO authenticated
USING (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  manager_id = auth.uid()
);

-- Managers can delete their own drafts
CREATE POLICY "Managers can delete own drafts"
ON public.message_drafts
FOR DELETE
TO authenticated
USING (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_message_drafts_updated_at
BEFORE UPDATE ON public.message_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_message_drafts_manager_id ON public.message_drafts(manager_id);
CREATE INDEX idx_message_drafts_created_at ON public.message_drafts(created_at DESC);
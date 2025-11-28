-- Create custom message templates table
CREATE TABLE public.custom_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.custom_message_templates ENABLE ROW LEVEL SECURITY;

-- Policies: Managers can view their own templates
CREATE POLICY "Managers can view own templates"
ON public.custom_message_templates
FOR SELECT
TO authenticated
USING (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Policies: Managers can create their own templates
CREATE POLICY "Managers can create templates"
ON public.custom_message_templates
FOR INSERT
TO authenticated
WITH CHECK (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Policies: Managers can update their own templates
CREATE POLICY "Managers can update own templates"
ON public.custom_message_templates
FOR UPDATE
TO authenticated
USING (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Policies: Managers can delete their own templates
CREATE POLICY "Managers can delete own templates"
ON public.custom_message_templates
FOR DELETE
TO authenticated
USING (
  manager_id = auth.uid() AND
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Create index for performance
CREATE INDEX idx_custom_templates_manager ON public.custom_message_templates(manager_id, created_at DESC);

-- Update trigger for updated_at
CREATE TRIGGER update_custom_templates_updated_at
  BEFORE UPDATE ON public.custom_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Add sharing columns to custom_message_templates
ALTER TABLE public.custom_message_templates
ADD COLUMN is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN shared_at TIMESTAMP WITH TIME ZONE;

-- Create index for shared templates
CREATE INDEX idx_custom_templates_shared ON public.custom_message_templates(is_shared, created_at DESC) WHERE is_shared = true;

-- Update policy to allow managers to view shared templates from other managers
DROP POLICY IF EXISTS "Managers can view own templates" ON public.custom_message_templates;

CREATE POLICY "Managers can view templates"
ON public.custom_message_templates
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) AND
  (manager_id = auth.uid() OR is_shared = true)
);

-- Create a view to get template creator information
CREATE OR REPLACE VIEW public.custom_templates_with_creator AS
SELECT 
  ct.*,
  p.full_name as creator_name,
  p.phone_number as creator_phone
FROM public.custom_message_templates ct
LEFT JOIN public.profiles p ON ct.manager_id = p.id;

-- Grant access to the view
GRANT SELECT ON public.custom_templates_with_creator TO authenticated;
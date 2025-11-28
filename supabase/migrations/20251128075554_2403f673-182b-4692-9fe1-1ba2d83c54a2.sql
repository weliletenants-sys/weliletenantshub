-- Check and fix all RLS policies for custom_message_templates
-- First, drop all existing policies
DROP POLICY IF EXISTS "Managers can view templates" ON custom_message_templates;
DROP POLICY IF EXISTS "Managers can insert own templates" ON custom_message_templates;  
DROP POLICY IF EXISTS "Managers can update own templates" ON custom_message_templates;
DROP POLICY IF EXISTS "Managers can delete own templates" ON custom_message_templates;

-- Recreate policies with correct logic
-- Allow managers to view their own templates OR shared templates from others
CREATE POLICY "Managers can view templates"
ON custom_message_templates
FOR SELECT
TO authenticated
USING (
  -- User must be a manager
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'manager'
  )
  AND (
    -- Can see own templates
    manager_id = auth.uid() 
    OR 
    -- Can see shared templates from other managers
    is_shared = true
  )
);

-- Allow managers to insert their own templates
CREATE POLICY "Managers can insert own templates"
ON custom_message_templates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'manager'
  )
  AND manager_id = auth.uid()
);

-- Allow managers to update only their own templates
CREATE POLICY "Managers can update own templates"
ON custom_message_templates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'manager'
  )
  AND manager_id = auth.uid()
)
WITH CHECK (
  manager_id = auth.uid()
);

-- Allow managers to delete only their own templates
CREATE POLICY "Managers can delete own templates"
ON custom_message_templates
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'manager'
  )
  AND manager_id = auth.uid()
);
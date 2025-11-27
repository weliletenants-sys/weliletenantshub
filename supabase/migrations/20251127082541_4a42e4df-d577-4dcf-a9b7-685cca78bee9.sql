-- Add UPDATE policy for service_centre_managers so managers can update their area
CREATE POLICY "Managers can update own data"
ON public.service_centre_managers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
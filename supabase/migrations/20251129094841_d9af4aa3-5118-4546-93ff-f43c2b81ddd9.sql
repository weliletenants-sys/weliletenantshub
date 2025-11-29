-- Allow managers to delete collections
CREATE POLICY "Managers can delete collections"
ON public.collections
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
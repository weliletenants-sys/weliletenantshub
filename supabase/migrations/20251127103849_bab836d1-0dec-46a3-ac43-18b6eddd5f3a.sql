-- Allow managers to update any tenant
CREATE POLICY "Managers can update any tenant"
ON public.tenants
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Allow managers to delete any tenant
CREATE POLICY "Managers can delete any tenant"
ON public.tenants
FOR DELETE
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);
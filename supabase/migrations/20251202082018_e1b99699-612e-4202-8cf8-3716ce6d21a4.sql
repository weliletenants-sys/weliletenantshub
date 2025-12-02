-- Create password change requests table
CREATE TABLE public.password_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  handled_at TIMESTAMP WITH TIME ZONE,
  handled_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agents can insert own password change requests"
  ON public.password_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

CREATE POLICY "Agents can view own password change requests"
  ON public.password_change_requests
  FOR SELECT
  TO authenticated
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can view all password change requests"
  ON public.password_change_requests
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role) OR 
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Managers can update password change requests"
  ON public.password_change_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role) OR 
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Create trigger for updated_at
CREATE TRIGGER update_password_change_requests_updated_at
  BEFORE UPDATE ON public.password_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_password_change_requests_agent_id ON public.password_change_requests(agent_id);
CREATE INDEX idx_password_change_requests_status ON public.password_change_requests(status);
CREATE INDEX idx_password_change_requests_requested_at ON public.password_change_requests(requested_at DESC);
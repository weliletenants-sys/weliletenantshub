-- Create withdrawal requests table
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent transfers table
CREATE TABLE public.agent_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  to_agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  recipient_phone TEXT NOT NULL,
  transferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for withdrawal_requests
CREATE POLICY "Agents can view own withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "Agents can insert own withdrawal requests"
ON public.withdrawal_requests
FOR INSERT
TO authenticated
WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "Managers can view all withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can update withdrawal requests"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for agent_transfers
CREATE POLICY "Agents can view own transfers (sent or received)"
ON public.agent_transfers
FOR SELECT
TO authenticated
USING (
  from_agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()) OR
  to_agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
);

CREATE POLICY "Agents can insert own transfers"
ON public.agent_transfers
FOR INSERT
TO authenticated
WITH CHECK (from_agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "Managers can view all transfers"
ON public.agent_transfers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_withdrawal_requests_agent_id ON public.withdrawal_requests(agent_id);
CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX idx_agent_transfers_from_agent ON public.agent_transfers(from_agent_id);
CREATE INDEX idx_agent_transfers_to_agent ON public.agent_transfers(to_agent_id);

-- Update trigger for withdrawal_requests
CREATE TRIGGER update_withdrawal_requests_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Add suspension fields to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Create index for faster suspension status queries
CREATE INDEX IF NOT EXISTS idx_agents_is_suspended ON public.agents(is_suspended);

-- Add comment explaining the suspension system
COMMENT ON COLUMN public.agents.is_suspended IS 'Whether the agent is currently suspended (temporarily disabled)';
COMMENT ON COLUMN public.agents.suspended_at IS 'Timestamp when the agent was suspended';
COMMENT ON COLUMN public.agents.suspended_by IS 'Manager who suspended the agent';
COMMENT ON COLUMN public.agents.suspension_reason IS 'Reason for suspension';
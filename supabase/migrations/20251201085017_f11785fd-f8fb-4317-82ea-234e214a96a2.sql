-- Create version_history table to track all deployed versions
CREATE TABLE IF NOT EXISTS public.version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  deployed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT,
  deployed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create version_adoptions table to track when users adopt new versions
CREATE TABLE IF NOT EXISTS public.version_adoptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  version TEXT NOT NULL,
  adopted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  device_info JSONB,
  UNIQUE(user_id, version)
);

-- Enable RLS
ALTER TABLE public.version_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_adoptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for version_history
CREATE POLICY "Anyone can view version history"
  ON public.version_history FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert version history"
  ON public.version_history FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update version history"
  ON public.version_history FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for version_adoptions
CREATE POLICY "Users can insert own adoptions"
  ON public.version_adoptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own adoptions"
  ON public.version_adoptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all adoptions"
  ON public.version_adoptions FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_version_history_deployed_at ON public.version_history(deployed_at DESC);
CREATE INDEX idx_version_adoptions_version ON public.version_adoptions(version);
CREATE INDEX idx_version_adoptions_user_id ON public.version_adoptions(user_id);
CREATE INDEX idx_version_adoptions_adopted_at ON public.version_adoptions(adopted_at DESC);

-- Insert current version as first entry
INSERT INTO public.version_history (version, deployed_at, description)
VALUES ('2.0.1', now(), 'Automatic updates system enabled with version tracking')
ON CONFLICT (version) DO NOTHING;
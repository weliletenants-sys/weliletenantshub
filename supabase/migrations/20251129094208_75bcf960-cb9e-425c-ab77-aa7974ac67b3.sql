-- Create performance_metrics table for tracking app stability
CREATE TABLE public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_type TEXT NOT NULL, -- mobile, tablet, desktop
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,
  page_route TEXT NOT NULL,
  load_time_ms INTEGER,
  error_type TEXT,
  error_message TEXT,
  network_latency_ms INTEGER,
  memory_usage_mb NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Agents and managers can insert their own metrics
CREATE POLICY "Users can insert own metrics"
ON public.performance_metrics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Managers can view all metrics
CREATE POLICY "Managers can view all metrics"
ON public.performance_metrics
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create index for faster queries
CREATE INDEX idx_performance_metrics_created_at ON public.performance_metrics(created_at DESC);
CREATE INDEX idx_performance_metrics_user_id ON public.performance_metrics(user_id);
CREATE INDEX idx_performance_metrics_device_type ON public.performance_metrics(device_type);
-- Create landlords table
CREATE TABLE IF NOT EXISTS public.landlords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_name TEXT NOT NULL,
  landlord_phone TEXT NOT NULL UNIQUE,
  landlord_id_url TEXT,
  registered_by UUID NOT NULL REFERENCES public.agents(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landlords ENABLE ROW LEVEL SECURITY;

-- RLS Policies for landlords
CREATE POLICY "Agents can view all landlords"
  ON public.landlords FOR SELECT
  USING (true);

CREATE POLICY "Agents can insert landlords"
  ON public.landlords FOR INSERT
  WITH CHECK (
    registered_by IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view all landlords"
  ON public.landlords FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Add wallet balance column to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;

-- Add landlord_id reference to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS landlord_id UUID REFERENCES public.landlords(id);

-- Create index for faster landlord phone lookup
CREATE INDEX IF NOT EXISTS idx_landlords_phone ON public.landlords(landlord_phone);

-- Create trigger for landlords updated_at
CREATE TRIGGER update_landlords_updated_at
  BEFORE UPDATE ON public.landlords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
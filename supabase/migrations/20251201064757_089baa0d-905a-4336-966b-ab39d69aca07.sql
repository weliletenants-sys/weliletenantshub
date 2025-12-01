-- Add new fields to landlords table for enhanced registration and verification
ALTER TABLE public.landlords
ADD COLUMN properties TEXT,
ADD COLUMN lc1_chairperson_name TEXT,
ADD COLUMN lc1_chairperson_phone TEXT,
ADD COLUMN village_cell_location TEXT,
ADD COLUMN google_maps_link TEXT,
ADD COLUMN is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN verified_by UUID REFERENCES public.profiles(id),
ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for verification queries
CREATE INDEX idx_landlords_verification ON public.landlords(is_verified, verified_at);

-- Add RLS policy for managers to update verification status
CREATE POLICY "Managers can verify landlords"
ON public.landlords
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
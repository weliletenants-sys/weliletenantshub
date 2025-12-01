-- Enable realtime for landlords table
ALTER TABLE public.landlords REPLICA IDENTITY FULL;

-- Add landlords table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.landlords;
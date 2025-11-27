-- Enable realtime for collections table
-- This allows managers to see payment submissions instantly

-- Add collections table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.collections;
-- Enable real-time updates for profiles table
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
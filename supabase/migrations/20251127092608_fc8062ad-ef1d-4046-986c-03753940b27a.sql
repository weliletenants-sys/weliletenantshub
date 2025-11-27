-- Enable realtime for tenants table
ALTER TABLE public.tenants REPLICA IDENTITY FULL;

-- Enable realtime for collections table
ALTER TABLE public.collections REPLICA IDENTITY FULL;

-- Enable realtime for agents table
ALTER TABLE public.agents REPLICA IDENTITY FULL;

-- Enable realtime for profiles table
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
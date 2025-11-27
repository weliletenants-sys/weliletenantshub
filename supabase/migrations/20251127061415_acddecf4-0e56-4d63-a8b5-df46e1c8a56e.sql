-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix search_path for create_agent_profile function
CREATE OR REPLACE FUNCTION public.create_agent_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'agent' THEN
    INSERT INTO public.agents (user_id)
    VALUES (NEW.id);
  ELSIF NEW.role = 'manager' THEN
    INSERT INTO public.service_centre_managers (user_id)
    VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
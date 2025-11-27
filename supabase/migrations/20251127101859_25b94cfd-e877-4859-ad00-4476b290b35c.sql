-- Create trigger to sync profile roles to user_roles table
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing role for this user
  DELETE FROM public.user_roles WHERE user_id = NEW.id;
  
  -- Insert new role based on profile (cast through text to convert between enum types)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, (NEW.role::text)::app_role);
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_to_user_roles();

-- Backfill existing profiles into user_roles (cast through text)
INSERT INTO public.user_roles (user_id, role)
SELECT id, (role::text)::app_role
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;
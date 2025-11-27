-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::text::app_role
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Update RLS policies to use has_role function

-- Drop old policies on agents
DROP POLICY IF EXISTS "Managers can view all agents" ON public.agents;

-- Create new policy using has_role
CREATE POLICY "Managers can view all agents" ON public.agents
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'admin')
);

-- Drop old policies on collections
DROP POLICY IF EXISTS "Managers can view all collections" ON public.collections;

-- Create new policy using has_role
CREATE POLICY "Managers can view all collections" ON public.collections
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'admin')
);

-- Drop old policies on tenants
DROP POLICY IF EXISTS "Managers can view all tenants" ON public.tenants;

-- Create new policy using has_role
CREATE POLICY "Managers can view all tenants" ON public.tenants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'admin')
);

-- Add RLS policies for user_roles table
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Prevent users from updating their own role in profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Add admin policies for profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profiles" ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));
-- Fix security definer view issue by removing the view and using direct queries with RLS
DROP VIEW IF EXISTS public.custom_templates_with_creator;

-- Instead, we'll query the tables directly and RLS will handle permissions
-- No view needed - the client can join the tables directly
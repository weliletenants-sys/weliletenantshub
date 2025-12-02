-- Add archive functionality to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- Create index for faster queries on archived tenants
CREATE INDEX IF NOT EXISTS idx_tenants_archived ON public.tenants(is_archived) WHERE is_archived = false;

-- Create index for archived_at for sorting
CREATE INDEX IF NOT EXISTS idx_tenants_archived_at ON public.tenants(archived_at) WHERE archived_at IS NOT NULL;
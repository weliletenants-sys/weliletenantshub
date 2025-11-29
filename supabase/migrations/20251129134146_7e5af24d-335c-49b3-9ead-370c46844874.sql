-- Drop the existing constraint
ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_status_check;

-- Update old 'completed' status to 'verified'
UPDATE public.collections 
SET status = 'verified' 
WHERE status = 'completed';

-- Update any 'failed' status to 'rejected'
UPDATE public.collections 
SET status = 'rejected' 
WHERE status = 'failed';

-- Add new constraint with correct status values
ALTER TABLE public.collections 
ADD CONSTRAINT collections_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text]));
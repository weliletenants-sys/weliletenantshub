-- Add column to track who created the payment
ALTER TABLE collections ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add column to track if payment was created by manager
ALTER TABLE collections ADD COLUMN IF NOT EXISTS created_by_manager boolean DEFAULT false;

-- Update existing payments to mark them as agent-created (assuming all existing are agent-created)
UPDATE collections SET created_by_manager = false WHERE created_by_manager IS NULL;

-- Create trigger to auto-verify manager payments
CREATE OR REPLACE FUNCTION auto_verify_manager_payments()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if creator is a manager
  IF NEW.created_by_manager = true THEN
    NEW.status := 'verified';
    NEW.verified_at := now();
    NEW.verified_by := NEW.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_verify_manager_payments
  BEFORE INSERT ON collections
  FOR EACH ROW
  EXECUTE FUNCTION auto_verify_manager_payments();
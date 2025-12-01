-- Function to automatically update agent wallet when payment is verified
CREATE OR REPLACE FUNCTION update_agent_wallet_on_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update wallet if payment status changed to 'verified'
  IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status != 'verified') THEN
    -- Add commission to agent's wallet balance
    UPDATE agents
    SET 
      wallet_balance = COALESCE(wallet_balance, 0) + NEW.commission,
      monthly_earnings = COALESCE(monthly_earnings, 0) + NEW.commission
    WHERE id = NEW.agent_id;
    
    -- Log the wallet update
    RAISE NOTICE 'Added commission % to agent % wallet', NEW.commission, NEW.agent_id;
  END IF;
  
  -- If payment status changed from verified to something else, subtract commission
  IF OLD.status = 'verified' AND NEW.status != 'verified' THEN
    UPDATE agents
    SET 
      wallet_balance = COALESCE(wallet_balance, 0) - NEW.commission,
      monthly_earnings = COALESCE(monthly_earnings, 0) - NEW.commission
    WHERE id = NEW.agent_id;
    
    RAISE NOTICE 'Subtracted commission % from agent % wallet', NEW.commission, NEW.agent_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on collections table
DROP TRIGGER IF EXISTS trigger_update_agent_wallet ON collections;
CREATE TRIGGER trigger_update_agent_wallet
  AFTER UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_wallet_on_verification();

-- Also handle new verified payments (for manager-created payments that auto-verify)
DROP TRIGGER IF EXISTS trigger_update_agent_wallet_insert ON collections;
CREATE TRIGGER trigger_update_agent_wallet_insert
  AFTER INSERT ON collections
  FOR EACH ROW
  WHEN (NEW.status = 'verified')
  EXECUTE FUNCTION update_agent_wallet_on_verification();
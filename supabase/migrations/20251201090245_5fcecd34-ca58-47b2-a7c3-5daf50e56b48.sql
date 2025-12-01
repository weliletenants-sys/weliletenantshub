-- Create trigger to automatically update agent wallet when collection is verified
CREATE TRIGGER trigger_update_agent_wallet_on_verification
  AFTER UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_wallet_on_verification();
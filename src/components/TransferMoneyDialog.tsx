import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wallet, ArrowRightLeft, User } from "lucide-react";
import { haptics } from "@/utils/haptics";

interface TransferMoneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  currentBalance: number;
  onSuccess?: () => void;
}

export function TransferMoneyDialog({
  open,
  onOpenChange,
  agentId,
  currentBalance,
  onSuccess,
}: TransferMoneyDialogProps) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientName, setRecipientName] = useState<string | null>(null);

  const handlePhoneChange = async (phoneNumber: string) => {
    setPhone(phoneNumber);
    
    if (phoneNumber.length >= 10) {
      // Search for agent by phone
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("phone_number", phoneNumber)
        .eq("role", "agent")
        .maybeSingle();

      if (data && !error) {
        setRecipientName(data.full_name || "Unknown Agent");
      } else {
        setRecipientName(null);
      }
    } else {
      setRecipientName(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.light(); // Form submission attempt

    const transferAmount = parseFloat(amount);

    if (!transferAmount || transferAmount <= 0) {
      haptics.error(); // Validation error
      toast.error("Please enter a valid amount");
      return;
    }

    if (transferAmount > currentBalance) {
      haptics.error(); // Validation error
      toast.error("Insufficient balance");
      return;
    }

    if (!phone || phone.length < 10) {
      haptics.error(); // Validation error
      toast.error("Please enter a valid phone number");
      return;
    }

    setIsSubmitting(true);

    try {
      // Find recipient agent by phone
      const { data: recipientProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phone)
        .eq("role", "agent")
        .maybeSingle();

      if (profileError || !recipientProfile) {
        haptics.error(); // Error feedback
        toast.error("Recipient agent not found");
        setIsSubmitting(false);
        return;
      }

      const { data: recipientAgent, error: agentError } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", recipientProfile.id)
        .maybeSingle();

      if (agentError || !recipientAgent) {
        haptics.error(); // Error feedback
        toast.error("Recipient agent not found");
        setIsSubmitting(false);
        return;
      }

      if (recipientAgent.id === agentId) {
        haptics.error(); // Error feedback
        toast.error("Cannot transfer to yourself");
        setIsSubmitting(false);
        return;
      }

      // Create transfer record
      const { error: transferError } = await supabase
        .from("agent_transfers")
        .insert({
          from_agent_id: agentId,
          to_agent_id: recipientAgent.id,
          amount: transferAmount,
          recipient_phone: phone,
          status: "completed",
        });

      if (transferError) throw transferError;

      // Update sender balance (deduct)
      const { error: senderError } = await supabase
        .from("agents")
        .update({ wallet_balance: currentBalance - transferAmount })
        .eq("id", agentId);

      if (senderError) throw senderError;

      // Update recipient balance (add)
      const { data: recipientData, error: recipientBalanceError } = await supabase
        .from("agents")
        .select("wallet_balance")
        .eq("id", recipientAgent.id)
        .single();

      if (recipientBalanceError) throw recipientBalanceError;

      const { error: recipientUpdateError } = await supabase
        .from("agents")
        .update({ 
          wallet_balance: (recipientData.wallet_balance || 0) + transferAmount 
        })
        .eq("id", recipientAgent.id);

      if (recipientUpdateError) throw recipientUpdateError;

      haptics.success(); // Success feedback
      toast.success(`UGX ${transferAmount.toLocaleString()} transferred successfully`, {
        description: `Sent to ${recipientName || phone}`,
      });

      setAmount("");
      setPhone("");
      setRecipientName(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error transferring funds:", error);
      haptics.error(); // Error feedback
      toast.error("Failed to transfer funds");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        className="flex-1 w-full sm:w-auto"
        onClick={() => onOpenChange(true)}
      >
        <ArrowRightLeft className="h-5 w-5 mr-2" />
        Transfer
      </Button>
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle className="text-xl">Transfer Money</DialogTitle>
          </div>
          <DialogDescription>
            Send money to another agent instantly using their phone number
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200">
              <Wallet className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600 font-medium">Available Balance</p>
                <p className="text-lg font-bold text-purple-900">
                  UGX {currentBalance.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Recipient Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter agent phone number"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              required
              className="text-lg"
            />
            {recipientName && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <User className="h-4 w-4" />
                <span>Agent found: {recipientName}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Transfer Amount (UGX)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              max={currentBalance}
              step="1"
              required
              className="text-lg"
            />
            <p className="text-xs text-muted-foreground">
              Maximum: UGX {currentBalance.toLocaleString()}
            </p>
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="mr-2 h-5 w-5" />
                  Transfer Now
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

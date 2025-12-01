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
import { Loader2, Wallet, ArrowDownToLine } from "lucide-react";
import { haptics } from "@/utils/haptics";

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  currentBalance: number;
  onSuccess?: () => void;
}

export function WithdrawDialog({
  open,
  onOpenChange,
  agentId,
  currentBalance,
  onSuccess,
}: WithdrawDialogProps) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.light(); // Form submission attempt

    const withdrawAmount = parseFloat(amount);

    if (!withdrawAmount || withdrawAmount <= 0) {
      haptics.error(); // Validation error
      toast.error("Please enter a valid amount");
      return;
    }

    if (withdrawAmount > currentBalance) {
      haptics.error(); // Validation error
      toast.error("Insufficient balance");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("withdrawal_requests")
        .insert({
          agent_id: agentId,
          amount: withdrawAmount,
          status: "pending",
        });

      if (error) throw error;

      haptics.success(); // Success feedback
      toast.success(`Withdrawal request for UGX ${withdrawAmount.toLocaleString()} submitted`, {
        description: "Your request is pending manager approval",
      });

      setAmount("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting withdrawal:", error);
      haptics.error(); // Error feedback
      toast.error("Failed to submit withdrawal request");
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
        <ArrowDownToLine className="h-5 w-5 mr-2" />
        Withdraw
      </Button>
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
              <ArrowDownToLine className="h-5 w-5 text-green-600" />
            </div>
            <DialogTitle className="text-xl">Withdraw Funds</DialogTitle>
          </div>
          <DialogDescription>
            Request to withdraw funds from your wallet. Requires manager approval.
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
            <Label htmlFor="amount">Withdrawal Amount (UGX)</Label>
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
                  Submitting...
                </>
              ) : (
                <>
                  <ArrowDownToLine className="mr-2 h-5 w-5" />
                  Request Withdrawal
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

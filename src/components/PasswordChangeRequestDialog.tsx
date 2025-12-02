import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/utils/haptics";

interface PasswordChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export function PasswordChangeRequestDialog({ 
  open, 
  onOpenChange, 
  agentId 
}: PasswordChangeRequestDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!reason.trim()) {
      haptics.error();
      toast.error("Please provide a reason for password change");
      return;
    }

    if (reason.length < 10) {
      haptics.error();
      toast.error("Reason must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    haptics.light();

    try {
      const { error } = await supabase
        .from("password_change_requests")
        .insert({
          agent_id: agentId,
          reason: reason.trim(),
          status: "pending"
        });

      if (error) throw error;

      haptics.success();
      toast.success("Password change request submitted successfully");
      setReason("");
      onOpenChange(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["password-change-requests"] });
    } catch (error: any) {
      haptics.error();
      console.error("Error submitting password change request:", error);
      toast.error(error.message || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Password Change</DialogTitle>
          <DialogDescription>
            Submit a request to change your password. A manager will review and approve your request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Password Change *</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Forgot password, security concern, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters required
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim() || reason.length < 10}
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
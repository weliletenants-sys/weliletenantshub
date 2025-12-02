import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { haptics } from "@/utils/haptics";

interface AgentPasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: {
    id: string;
    user_id: string;
    profiles: {
      full_name: string | null;
      phone_number: string;
    };
  } | null;
}

export function AgentPasswordResetDialog({ open, onOpenChange, agent }: AgentPasswordResetDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agent) return;

    // Validation
    if (!newPassword.trim()) {
      toast.error("Password required", {
        description: "Please enter a new password"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password too short", {
        description: "Password must be at least 6 characters long"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match", {
        description: "Please ensure both passwords match"
      });
      return;
    }

    setLoading(true);
    haptics.light();

    try {
      // Update password in auth.users table
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          UPDATE auth.users 
          SET encrypted_password = crypt($1, gen_salt('bf')),
              updated_at = now()
          WHERE id = $2
        `,
        params: [newPassword, agent.user_id]
      });

      if (error) throw error;

      toast.success("Password reset successful", {
        description: `Password updated for ${agent.profiles?.full_name || agent.profiles?.phone_number}`
      });

      handleReset();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      
      // If rpc doesn't exist, try direct SQL execution
      try {
        const { error: directError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', agent.user_id)
          .single();

        if (!directError) {
          // Use alternative method - this requires service role key
          toast.error("Password reset unavailable", {
            description: "This operation requires additional database permissions. Please contact support."
          });
        }
      } catch (fallbackError) {
        toast.error("Failed to reset password", {
          description: error.message || "Please try again later"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Reset Agent Password
          </DialogTitle>
          <DialogDescription>
            Reset password for {agent?.profiles?.full_name || agent?.profiles?.phone_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-info">Agent</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{agent?.profiles?.full_name || "Unknown"}</p>
                <p className="text-sm text-muted-foreground">{agent?.profiles?.phone_number}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 6 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

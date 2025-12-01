import { useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { useAuth } from "@/hooks/useAuth";
import { Wallet, UserPlus } from "lucide-react";

interface RegisterLandlordProps {
  prefilledPhone?: string;
  onSuccess?: (landlordId: string) => void;
  embedded?: boolean;
}

const RegisterLandlord = ({ prefilledPhone = "", onSuccess, embedded = false }: RegisterLandlordProps) => {
  const navigate = useNavigate();
  const { agentId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    landlordName: "",
    landlordPhone: prefilledPhone,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentId) {
      toast.error("Agent ID not found");
      return;
    }

    setIsSubmitting(true);
    haptics.light();

    try {
      // Insert landlord
      const { data: landlord, error: landlordError } = await supabase
        .from("landlords")
        .insert({
          landlord_name: formData.landlordName,
          landlord_phone: formData.landlordPhone,
          registered_by: agentId,
        })
        .select()
        .single();

      if (landlordError) {
        if (landlordError.code === '23505') { // Unique constraint violation
          toast.error("This landlord phone number is already registered");
        } else {
          throw landlordError;
        }
        return;
      }

      // Update agent wallet balance (+500)
      const { data: currentAgent, error: fetchError } = await supabase
        .from("agents")
        .select("wallet_balance")
        .eq("id", agentId)
        .single();

      if (fetchError) throw fetchError;

      const { error: walletError } = await supabase
        .from("agents")
        .update({ 
          wallet_balance: (currentAgent.wallet_balance || 0) + 500
        })
        .eq("id", agentId);

      if (walletError) throw walletError;

      haptics.success();
      toast.success("🎉 Landlord registered! UGX 500 added to wallet", {
        duration: 5000,
      });

      if (onSuccess && landlord) {
        onSuccess(landlord.id);
      } else {
        navigate("/agent/dashboard");
      }
    } catch (error) {
      console.error("Error registering landlord:", error);
      toast.error("Failed to register landlord");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const content = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Register New Landlord
        </CardTitle>
        <CardDescription>
          Earn instant UGX 500 reward for each landlord registration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold text-primary">Instant Reward</p>
                <p className="text-sm text-muted-foreground">
                  UGX 500 added to your wallet immediately
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="landlordName">Landlord Name *</Label>
              <Input
                id="landlordName"
                name="landlordName"
                value={formData.landlordName}
                onChange={handleChange}
                placeholder="Enter landlord's full name"
                required
                className="h-14 text-lg"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="landlordPhone">Landlord Phone *</Label>
              <Input
                id="landlordPhone"
                name="landlordPhone"
                type="tel"
                value={formData.landlordPhone}
                onChange={handleChange}
                placeholder="e.g., 0700123456"
                required
                className="h-14 text-lg"
                disabled={!!prefilledPhone}
              />
            </div>
          </div>

          <div className="flex gap-4">
            {!embedded && (
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-14"
                onClick={() => navigate("/agent/dashboard")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              className="flex-1 h-14 text-lg" 
              disabled={isSubmitting || !agentId}
            >
              {isSubmitting ? "Registering..." : "Register & Earn UGX 500"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  if (embedded) {
    return content;
  }

  return (
    <AgentLayout currentPage="/agent/register-landlord">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Register Landlord</h1>
          <p className="text-muted-foreground">Add a new landlord and earn UGX 500</p>
        </div>
        {content}
      </div>
    </AgentLayout>
  );
};

export default RegisterLandlord;

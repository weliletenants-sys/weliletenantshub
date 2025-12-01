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
    properties: "",
    lc1ChairpersonName: "",
    lc1ChairpersonPhone: "",
    villageCellLocation: "",
    googleMapsLink: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.light(); // Form submission attempt

    if (!agentId) {
      haptics.error(); // Validation error
      toast.error("Agent ID not found");
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert landlord
      const { data: landlord, error: landlordError } = await supabase
        .from("landlords")
        .insert({
          landlord_name: formData.landlordName,
          landlord_phone: formData.landlordPhone,
          properties: formData.properties,
          lc1_chairperson_name: formData.lc1ChairpersonName,
          lc1_chairperson_phone: formData.lc1ChairpersonPhone,
          village_cell_location: formData.villageCellLocation,
          google_maps_link: formData.googleMapsLink,
          registered_by: agentId,
        })
        .select()
        .single();

      if (landlordError) {
        haptics.error(); // Error feedback
        if (landlordError.code === '23505') { // Unique constraint violation
          toast.error("This landlord phone number is already registered");
        } else {
          throw landlordError;
        }
        return;
      }

      haptics.success(); // Success feedback
      toast.success("🎉 Landlord registered! Awaiting manager verification for UGX 500 reward", {
        duration: 5000,
      });

      if (onSuccess && landlord) {
        onSuccess(landlord.id);
      } else {
        navigate("/agent/dashboard");
      }
    } catch (error) {
      console.error("Error registering landlord:", error);
      haptics.error(); // Error feedback
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
          Earn UGX 500 reward after manager verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold text-primary">Verification Reward</p>
                <p className="text-sm text-muted-foreground">
                  UGX 500 added after manager verifies landlord details
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Landlord Information</h3>
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

              <div className="space-y-2">
                <Label htmlFor="properties">Properties Owned *</Label>
                <Input
                  id="properties"
                  name="properties"
                  value={formData.properties}
                  onChange={handleChange}
                  placeholder="e.g., House 5A, Shop 2B, Apartment Block C"
                  required
                  className="h-14 text-lg"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Location & LC1 Details</h3>
              <div className="space-y-2">
                <Label htmlFor="villageCellLocation">Village/Cell Location *</Label>
                <Input
                  id="villageCellLocation"
                  name="villageCellLocation"
                  value={formData.villageCellLocation}
                  onChange={handleChange}
                  placeholder="e.g., Kansanga, Makindye Division"
                  required
                  className="h-14 text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lc1ChairpersonName">LC1 Chairperson Name *</Label>
                <Input
                  id="lc1ChairpersonName"
                  name="lc1ChairpersonName"
                  value={formData.lc1ChairpersonName}
                  onChange={handleChange}
                  placeholder="Enter LC1 chairperson name"
                  required
                  className="h-14 text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lc1ChairpersonPhone">LC1 Chairperson Phone *</Label>
                <Input
                  id="lc1ChairpersonPhone"
                  name="lc1ChairpersonPhone"
                  type="tel"
                  value={formData.lc1ChairpersonPhone}
                  onChange={handleChange}
                  placeholder="e.g., 0700123456"
                  required
                  className="h-14 text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleMapsLink">Google Maps Link *</Label>
                <Input
                  id="googleMapsLink"
                  name="googleMapsLink"
                  type="url"
                  value={formData.googleMapsLink}
                  onChange={handleChange}
                  placeholder="https://maps.google.com/..."
                  required
                  className="h-14 text-lg"
                />
              </div>
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
              {isSubmitting ? "Registering..." : "Submit for Verification"}
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

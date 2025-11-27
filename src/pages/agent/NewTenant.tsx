import { useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { addPendingTenant, isOnline } from "@/lib/offlineSync";
import { CloudOff } from "lucide-react";

const AgentNewTenant = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    tenantName: "",
    tenantPhone: "",
    rentAmount: "",
    currentBalance: "",
    landlordName: "",
    landlordPhone: "",
    lc1Name: "",
    lc1Phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agent) throw new Error("Agent profile not found");

      const rentAmount = parseFloat(formData.rentAmount);
      const registrationFee = rentAmount >= 200000 ? 20000 : 10000;
      const currentBalance = parseFloat(formData.currentBalance) || 0;

      const tenantData = {
        agent_id: agent.id,
        tenant_name: formData.tenantName,
        tenant_phone: formData.tenantPhone,
        rent_amount: rentAmount,
        registration_fee: registrationFee,
        landlord_name: formData.landlordName,
        landlord_phone: formData.landlordPhone,
        lc1_name: formData.lc1Name,
        lc1_phone: formData.lc1Phone,
        outstanding_balance: currentBalance,
      };

      if (isOnline()) {
        // Online: Save directly to database
        const { error } = await supabase.from("tenants").insert(tenantData);
        if (error) throw error;
        toast.success("Tenant added! UGX 5,000 credited to your wallet");
      } else {
        // Offline: Save to IndexedDB for later sync
        await addPendingTenant(tenantData);
        toast.success("Tenant saved offline! Will sync when back online.", {
          icon: <CloudOff className="h-4 w-4" />,
          duration: 5000,
        });
      }

      navigate("/agent/tenants");
    } catch (error: any) {
      toast.error(error.message || "Failed to add tenant");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const rentAmount = parseFloat(formData.rentAmount) || 0;
  const registrationFee = rentAmount >= 200000 ? 20000 : 10000;

  return (
    <AgentLayout currentPage="/agent/new-tenant">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Add New Tenant</h1>
          <p className="text-muted-foreground">Complete this form to add a new tenant</p>
        </div>

        {!isOnline() && (
          <Card className="border-warning bg-warning/5">
            <CardContent className="py-4 flex items-center gap-3">
              <CloudOff className="h-5 w-5 text-warning" />
              <div className="flex-1">
                <p className="font-medium text-sm">You're offline</p>
                <p className="text-xs text-muted-foreground">
                  Tenant will be saved locally and synced when back online
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Tenant Information</CardTitle>
            <CardDescription>
              Earn UGX 5,000 instantly when you add a new tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Tenant Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="tenantName">Tenant Name</Label>
                  <Input
                    id="tenantName"
                    name="tenantName"
                    value={formData.tenantName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenantPhone">Tenant Phone</Label>
                  <Input
                    id="tenantPhone"
                    name="tenantPhone"
                    type="tel"
                    value={formData.tenantPhone}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentAmount">Monthly Rent Amount (UGX)</Label>
                  <Input
                    id="rentAmount"
                    name="rentAmount"
                    type="number"
                    value={formData.rentAmount}
                    onChange={handleChange}
                    required
                  />
                  {rentAmount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Registration fee: UGX {registrationFee.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentBalance">Current Outstanding Balance (UGX)</Label>
                  <Input
                    id="currentBalance"
                    name="currentBalance"
                    type="number"
                    value={formData.currentBalance}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the total amount the tenant currently owes
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Landlord Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="landlordName">Landlord Name</Label>
                  <Input
                    id="landlordName"
                    name="landlordName"
                    value={formData.landlordName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="landlordPhone">Landlord Phone</Label>
                  <Input
                    id="landlordPhone"
                    name="landlordPhone"
                    type="tel"
                    value={formData.landlordPhone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">LC1 Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="lc1Name">LC1 Name</Label>
                  <Input
                    id="lc1Name"
                    name="lc1Name"
                    value={formData.lc1Name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lc1Phone">LC1 Phone</Label>
                  <Input
                    id="lc1Phone"
                    name="lc1Phone"
                    type="tel"
                    value={formData.lc1Phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/agent/tenants")}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Adding..." : "Add Tenant"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default AgentNewTenant;

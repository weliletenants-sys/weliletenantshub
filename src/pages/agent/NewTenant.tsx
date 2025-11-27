import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { isOnline } from "@/lib/offlineSync";
import { CloudOff } from "lucide-react";
import { useOptimisticTenantCreation } from "@/hooks/useOptimisticPayment";

const AgentNewTenant = () => {
  const navigate = useNavigate();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    tenantName: "",
    tenantPhone: "",
    currentBalance: "",
  });

  const createTenantMutation = useOptimisticTenantCreation();

  // Fetch agent ID on mount
  useEffect(() => {
    const fetchAgentId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (agent) setAgentId(agent.id);
    };

    fetchAgentId();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentId) {
      return;
    }

    const tenantData = {
      agent_id: agentId,
      tenant_name: formData.tenantName,
      tenant_phone: formData.tenantPhone,
      outstanding_balance: parseFloat(formData.currentBalance) || 0,
    };

    createTenantMutation.mutate(tenantData, {
      onSuccess: () => {
        navigate("/agent/tenants");
      },
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
            <CardTitle>Add New Tenant</CardTitle>
            <CardDescription>
              Quick registration - add more details later. Earn UGX 5,000 instantly!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantName">Tenant Name *</Label>
                  <Input
                    id="tenantName"
                    name="tenantName"
                    value={formData.tenantName}
                    onChange={handleChange}
                    placeholder="Enter tenant's full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenantPhone">Tenant Phone *</Label>
                  <Input
                    id="tenantPhone"
                    name="tenantPhone"
                    type="tel"
                    value={formData.tenantPhone}
                    onChange={handleChange}
                    placeholder="e.g., 0700123456"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentBalance">Outstanding Balance (UGX) *</Label>
                  <Input
                    id="currentBalance"
                    name="currentBalance"
                    type="number"
                    value={formData.currentBalance}
                    onChange={handleChange}
                    placeholder="Enter amount owed"
                    required
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total amount the tenant currently owes
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  ℹ️ You can add landlord info, LC1 details, and rent amount later by editing the tenant.
                </p>
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
                <Button type="submit" className="flex-1" disabled={createTenantMutation.isPending || !agentId}>
                  {createTenantMutation.isPending ? "Adding..." : "Add Tenant"}
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

import { useEffect, useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

const AgentTenants = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agent) return;

      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error: any) {
      toast.error("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      verified: "default",
      paying: "default",
      late: "destructive",
      defaulted: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <AgentLayout currentPage="/agent/tenants">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">My Tenants</h1>
            <p className="text-muted-foreground">Manage and track your tenant portfolio</p>
          </div>
          <Button onClick={() => navigate("/agent/new-tenant")}>
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tenant List</CardTitle>
            <CardDescription>
              Total: {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading tenants...</div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No tenants yet</p>
                <Button onClick={() => navigate("/agent/new-tenant")}>
                  Add Your First Tenant
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Rent Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow 
                        key={tenant.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/agent/tenants/${tenant.id}`)}
                      >
                        <TableCell className="font-medium">{tenant.tenant_name}</TableCell>
                        <TableCell>{tenant.tenant_phone}</TableCell>
                        <TableCell>UGX {parseFloat(tenant.rent_amount).toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                        <TableCell>{tenant.days_remaining || 0} days</TableCell>
                        <TableCell className="font-medium">
                          UGX {parseFloat(tenant.outstanding_balance).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default AgentTenants;

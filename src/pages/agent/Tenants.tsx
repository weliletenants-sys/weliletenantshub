import { useEffect, useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import { TenantListSkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TenantRow } from "@/components/TenantRow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Plus, AlertCircle } from "lucide-react";
import { useTenantListPrefetch } from "@/hooks/useTenantPrefetch";

const AgentTenants = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();
  
  // Initialize prefetching for visible tenants
  const { observeTenantRow } = useTenantListPrefetch(tenants);

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
      
      // Calculate days overdue for each tenant
      const today = new Date();
      const tenantsWithOverdue = (data || []).map(tenant => {
        if (tenant.next_payment_date) {
          const nextPayment = new Date(tenant.next_payment_date);
          const daysOverdue = Math.floor((today.getTime() - nextPayment.getTime()) / (1000 * 60 * 60 * 24));
          return {
            ...tenant,
            daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
            isOverdue: daysOverdue > 0
          };
        }
        return { ...tenant, daysOverdue: 0, isOverdue: false };
      });
      
      setTenants(tenantsWithOverdue);
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

  const overdueTenants = tenants
    .filter(t => t.isOverdue)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const renderTenantTable = (tenantList: any[]) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Rent Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>{activeTab === "overdue" ? "Days Overdue" : "Days Left"}</TableHead>
            <TableHead>Outstanding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenantList.map((tenant) => (
            <TenantRow
              key={tenant.id}
              tenant={tenant}
              activeTab={activeTab}
              observeTenantRow={observeTenantRow}
              getStatusBadge={getStatusBadge}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">
              All Tenants ({tenants.length})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-destructive data-[state=active]:text-destructive">
              <AlertCircle className="h-4 w-4 mr-2" />
              Overdue ({overdueTenants.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Tenants</CardTitle>
                <CardDescription>
                  Total: {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TenantListSkeleton />
                ) : tenants.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No tenants yet</p>
                    <Button onClick={() => navigate("/agent/new-tenant")}>
                      Add Your First Tenant
                    </Button>
                  </div>
                ) : (
                  renderTenantTable(tenants)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overdue">
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Overdue Tenants
                </CardTitle>
                <CardDescription>
                  {overdueTenants.length} tenant{overdueTenants.length !== 1 ? 's have' : ' has'} missed payment deadlines
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TenantListSkeleton />
                ) : overdueTenants.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No overdue tenants - great job! 🎉</p>
                  </div>
                ) : (
                  renderTenantTable(overdueTenants)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AgentLayout>
  );
};

export default AgentTenants;

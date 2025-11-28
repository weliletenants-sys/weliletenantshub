import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AgentLayout from "@/components/AgentLayout";
import { TenantListSkeleton } from "@/components/TenantDetailSkeleton";
import { VirtualizedList } from "@/components/VirtualizedList";
import { ContentTransition, StaggeredList } from "@/components/ContentTransition";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { RealtimeSyncIndicator } from "@/components/RealtimeSyncIndicator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TenantRow } from "@/components/TenantRow";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, AlertCircle } from "lucide-react";
import { useTenantListPrefetch } from "@/hooks/useTenantPrefetch";
import { useRealtimeTenants } from "@/hooks/useRealtimeSubscription";
import { useRealtimeSyncStatus } from "@/hooks/useRealtimeSyncStatus";
import type { Tables } from "@/integrations/supabase/types";

type Tenant = Tables<'tenants'>;

const AgentTenants = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [agentId, setAgentId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch agent ID
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

  // Fetch tenants with React Query (supports optimistic updates)
  const { data: tenants = [], isLoading, isFetching } = useQuery({
    queryKey: ['tenants', agentId],
    queryFn: async () => {
      if (!agentId) return [];

      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!agentId,
    placeholderData: (previousData) => previousData, // Show cached data while refetching
  });

  // Calculate days overdue with useMemo
  const tenantsWithOverdue = useMemo(() => {
    const today = new Date();
    return tenants.map(tenant => {
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
  }, [tenants]);
  
  // Initialize prefetching for visible tenants
  const { observeTenantRow } = useTenantListPrefetch(tenantsWithOverdue);
  
  // Enable real-time updates for tenants
  useRealtimeTenants(agentId);
  
  // Track sync status for visual indicators
  const { lastSyncTime } = useRealtimeSyncStatus('tenants');

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

  const overdueTenants = useMemo(() => 
    tenantsWithOverdue
      .filter(t => t.isOverdue)
      .sort((a, b) => b.daysOverdue - a.daysOverdue),
    [tenantsWithOverdue]
  );

  const renderTenantTable = (tenantList: any[]) => (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      {tenantList.length > 20 ? (
        <VirtualizedList
          items={tenantList}
          itemHeight={72}
          height="calc(100vh - 400px)"
          renderItem={(tenant) => (
            <TenantRow
              key={tenant.id}
              tenant={tenant}
              activeTab={activeTab}
              observeTenantRow={observeTenantRow}
              getStatusBadge={getStatusBadge}
            />
          )}
          className="border rounded-lg"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="h-12">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Phone</TableHead>
              <TableHead className="font-semibold">Rent</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">{activeTab === "overdue" ? "Overdue" : "Days"}</TableHead>
              <TableHead className="font-semibold text-right">Balance</TableHead>
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
      )}
    </div>
  );

  return (
    <AgentLayout currentPage="/agent/tenants">
      <ContentTransition
        loading={isLoading}
        skeleton={<TenantListSkeleton />}
      >
        <div className="space-y-6 animate-reveal">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                👥 My Tenants
                <RefreshIndicator isRefreshing={isFetching && !isLoading} />
                <RealtimeSyncIndicator lastSyncTime={lastSyncTime} compact />
              </h1>
              <p className="text-sm text-muted-foreground">Your portfolio</p>
            </div>
            <Button onClick={() => navigate("/agent/new-tenant")} size="lg" className="h-12 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
              <Plus className="h-5 w-5 mr-1" />
              Add
            </Button>
          </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="all" className="text-base">
              All ({tenantsWithOverdue.length})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-base text-destructive data-[state=active]:text-destructive">
              <AlertCircle className="h-4 w-4 mr-1" />
              Overdue ({overdueTenants.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">All Tenants</CardTitle>
                <CardDescription className="text-xs">
                  {tenantsWithOverdue.length} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <TenantListSkeleton />
                ) : tenantsWithOverdue.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">🏠</p>
                    <p className="text-muted-foreground mb-4 text-sm">No tenants yet</p>
                    <Button onClick={() => navigate("/agent/new-tenant")} size="lg" className="h-12">
                      Add Your First Tenant 🚀
                    </Button>
                  </div>
                ) : (
                  renderTenantTable(tenantsWithOverdue)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overdue">
            <Card className="border-destructive/50 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-destructive flex items-center gap-2 text-base">
                  <AlertCircle className="h-4 w-4" />
                  Overdue
                </CardTitle>
                <CardDescription className="text-xs">
                  {overdueTenants.length} missed deadline{overdueTenants.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <TenantListSkeleton />
                ) : overdueTenants.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-2">✨</p>
                    <p className="text-muted-foreground text-sm">All caught up! 🎉</p>
                  </div>
                ) : (
                  renderTenantTable(overdueTenants)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </ContentTransition>
    </AgentLayout>
  );
};

export default AgentTenants;

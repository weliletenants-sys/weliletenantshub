import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, AlertCircle } from "lucide-react";
import { useTenantListPrefetch } from "@/hooks/useTenantPrefetch";
import { useRealtimeTenants } from "@/hooks/useRealtimeSubscription";
import { useRealtimeSyncStatus } from "@/hooks/useRealtimeSyncStatus";
import type { Tables } from "@/integrations/supabase/types";

type Tenant = Tables<'tenants'>;

const AgentTenants = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "all");
  const [agentId, setAgentId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // Update active tab when URL search params change
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Fetch active (non-archived) tenants with React Query
  const { data: tenants = [], isLoading, isFetching } = useQuery({
    queryKey: ['tenants', agentId],
    queryFn: async () => {
      if (!agentId) return [];

      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("agent_id", agentId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!agentId,
    placeholderData: (previousData) => previousData, // Show cached data while refetching
  });

  // Fetch archived tenants separately
  const { data: archivedTenants = [], isLoading: archivedLoading } = useQuery({
    queryKey: ['archivedTenants', agentId],
    queryFn: async () => {
      if (!agentId) return [];

      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("agent_id", agentId)
        .eq("is_archived", true)
        .order("archived_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!agentId,
    placeholderData: (previousData) => previousData,
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
  
  // Enable real-time updates for archived tenants
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel('archived-tenants')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
          filter: `agent_id=eq.${agentId}`,
        },
        () => {
          // Invalidate both queries on any change
          queryClient.invalidateQueries({ queryKey: ['tenants', agentId] });
          queryClient.invalidateQueries({ queryKey: ['archivedTenants', agentId] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe().then(() => supabase.removeChannel(channel));
    };
  }, [agentId, queryClient]);
  
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

  const activeTenants = useMemo(() =>
    tenantsWithOverdue.filter(t => (t.outstanding_balance || 0) > 0),
    [tenantsWithOverdue]
  );

  const pipelineTenants = useMemo(() =>
    tenantsWithOverdue.filter(t => (t.outstanding_balance || 0) === 0),
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
          <TabsList className="grid w-full grid-cols-5 h-12">
            <TabsTrigger value="all" className="text-sm">
              All ({tenantsWithOverdue.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-sm">
              💰 ({activeTenants.length})
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-sm">
              📋 ({pipelineTenants.length})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-sm text-destructive data-[state=active]:text-destructive">
              <AlertCircle className="h-4 w-4" />
              ({overdueTenants.length})
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-sm text-muted-foreground">
              🗃️ ({archivedTenants.length})
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

          <TabsContent value="active">
            <Card className="border-primary/30 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-primary flex items-center gap-2 text-base">
                  💰 Active Tenants
                </CardTitle>
                <CardDescription className="text-xs">
                  {activeTenants.length} tenant{activeTenants.length !== 1 ? 's' : ''} with outstanding balances
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <TenantListSkeleton />
                ) : activeTenants.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-2">💰</p>
                    <p className="text-muted-foreground text-sm">No active tenants yet</p>
                  </div>
                ) : (
                  renderTenantTable(activeTenants)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline">
            <Card className="border-indigo-500/30 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-indigo-600 flex items-center gap-2 text-base">
                  📋 Pipeline Tenants
                </CardTitle>
                <CardDescription className="text-xs">
                  {pipelineTenants.length} tenant{pipelineTenants.length !== 1 ? 's' : ''} registered without outstanding balance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <TenantListSkeleton />
                ) : pipelineTenants.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-2">📋</p>
                    <p className="text-muted-foreground text-sm">No pipeline tenants</p>
                  </div>
                ) : (
                  renderTenantTable(pipelineTenants)
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

          <TabsContent value="archived">
            <Card className="border-muted hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-muted-foreground flex items-center gap-2 text-base">
                  🗃️ Archived Tenants
                </CardTitle>
                <CardDescription className="text-xs">
                  {archivedTenants.length} tenant{archivedTenants.length !== 1 ? 's' : ''} archived
                </CardDescription>
              </CardHeader>
              <CardContent>
                {archivedLoading ? (
                  <TenantListSkeleton />
                ) : archivedTenants.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-2">🗃️</p>
                    <p className="text-muted-foreground text-sm">No archived tenants</p>
                  </div>
                ) : (
                  renderTenantTable(archivedTenants)
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

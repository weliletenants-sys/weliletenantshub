import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, AlertCircle, TrendingUp, Shield, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { useRealtimeAllTenants, useRealtimeAllCollections, useRealtimeAgents, registerSyncCallback } from "@/hooks/useRealtimeSubscription";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalTenants: 0,
    pendingVerifications: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showTenantSearch, setShowTenantSearch] = useState(false);
  const [showAgentSearch, setShowAgentSearch] = useState(false);
  const [tenantSearchQuery, setTenantSearchQuery] = useState("");
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Subscribe to real-time updates for all agent activity
  useRealtimeAllTenants();
  useRealtimeAllCollections();
  useRealtimeAgents();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const [agentsResult, tenantsResult] = await Promise.all([
          supabase.from("agents").select("*"),
          supabase.from("tenants").select("*"),
        ]);

        if (agentsResult.error) {
          console.error("Error fetching agents:", agentsResult.error);
        }
        
        if (tenantsResult.error) {
          console.error("Error fetching tenants:", tenantsResult.error);
        }

        const totalAgents = agentsResult.data?.length || 0;
        const totalTenants = tenantsResult.data?.length || 0;
        const pendingVerifications = tenantsResult.data?.filter(t => t.status === 'pending').length || 0;

        setStats({
          totalAgents,
          activeAgents: totalAgents,
          totalTenants,
          pendingVerifications,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Listen for real-time sync events and refetch stats
    const unregisterCallback = registerSyncCallback((table) => {
      console.log(`Real-time update detected on ${table}, refreshing dashboard stats`);
      fetchStats();
    });

    return () => {
      unregisterCallback();
    };
  }, []);

  const handleRefresh = async () => {
    haptics.refresh();
    const [agentsResult, tenantsResult] = await Promise.all([
      supabase.from("agents").select("*"),
      supabase.from("tenants").select("*"),
    ]);

    const totalAgents = agentsResult.data?.length || 0;
    const totalTenants = tenantsResult.data?.length || 0;
    const pendingVerifications = tenantsResult.data?.filter(t => t.status === 'pending').length || 0;

    setStats({
      totalAgents,
      activeAgents: totalAgents,
      totalTenants,
      pendingVerifications,
    });
    
    toast.success("Dashboard refreshed");
  };

  const handleTenantSearch = async () => {
    if (!tenantSearchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          agents (
            profiles:user_id (
              full_name,
              phone_number
            )
          )
        `)
        .or(`tenant_name.ilike.%${tenantSearchQuery}%,tenant_phone.ilike.%${tenantSearchQuery}%`)
        .limit(10);

      if (error) throw error;

      setSearchResults(data || []);
      
      if (!data || data.length === 0) {
        toast.info("No tenants found matching your search");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search tenants");
    }
  };

  const handleAgentSearch = async () => {
    if (!agentSearchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    try {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number")
        .eq("role", "agent")
        .or(`full_name.ilike.%${agentSearchQuery}%,phone_number.ilike.%${agentSearchQuery}%`)
        .limit(10);

      if (profileError) throw profileError;

      const userIds = profiles?.map(p => p.id) || [];

      if (userIds.length === 0) {
        setSearchResults([]);
        toast.info("No agents found matching your search");
        return;
      }

      const { data, error } = await supabase
        .from("agents")
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number
          )
        `)
        .in("user_id", userIds);

      if (error) throw error;

      setSearchResults(data || []);
      
      if (!data || data.length === 0) {
        toast.info("No agents found matching your search");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search agents");
    }
  };

  if (isLoading) {
    return (
      <ManagerLayout currentPage="/manager/dashboard">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Manager Dashboard</h1>
            <p className="text-muted-foreground">Service Centre Overview</p>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Activity Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>

          {/* Quick Actions Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-10 w-40" />
              </CardContent>
            </Card>
          </div>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/dashboard">
      <PullToRefresh onRefresh={handleRefresh} pullingContent="">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Manager Dashboard</h1>
            <p className="text-muted-foreground">Service Centre Overview</p>
          </div>

          {/* Quick Search Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Search Tenants
                </CardTitle>
                <CardDescription>
                  Find tenants by name or phone number
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => {
                    setShowTenantSearch(true);
                    setSearchResults([]);
                    setTenantSearchQuery("");
                  }}
                >
                  <Search className="h-5 w-5 mr-2" />
                  Search Tenants
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Search Agents
                </CardTitle>
                <CardDescription>
                  Find agents by name or phone number
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => {
                    setShowAgentSearch(true);
                    setSearchResults([]);
                    setAgentSearchQuery("");
                  }}
                >
                  <Search className="h-5 w-5 mr-2" />
                  Search Agents
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeAgents} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTenants}</div>
              <p className="text-xs text-success mt-1">Across all agents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pending Verifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {stats.pendingVerifications}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Requires action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">94.2%</div>
              <p className="text-xs text-muted-foreground mt-1">Avg collection rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Access Card */}
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Access
            </CardTitle>
            <CardDescription>
              As a manager, you have admin privileges to manage users and system settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/admin')}
              className="w-full md:w-auto"
            >
              Open Admin Dashboard
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest tenant registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Monitor tenant additions in real-time
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="default">
                Pay All Verified Landlords
              </Button>
              <Button className="w-full" variant="outline">
                View Late Tenants
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-warning/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                {stats.pendingVerifications} landlord verifications are pending approval
              </p>
              <Button variant="default">Review Verifications</Button>
            </CardContent>
          </Card>
        </div>
      </div>
      </PullToRefresh>

      {/* Tenant Search Dialog */}
      <Dialog open={showTenantSearch} onOpenChange={setShowTenantSearch}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Tenants</DialogTitle>
            <DialogDescription>
              Search for tenants by name or phone number across all agents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter tenant name or phone number..."
                value={tenantSearchQuery}
                onChange={(e) => setTenantSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTenantSearch();
                  }
                }}
              />
              <Button onClick={handleTenantSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">Search Results ({searchResults.length})</h3>
                {searchResults.map((tenant: any) => (
                  <Card 
                    key={tenant.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      navigate(`/agent/tenants/${tenant.id}`);
                      setShowTenantSearch(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{tenant.tenant_name}</h4>
                          <p className="text-sm text-muted-foreground">{tenant.tenant_phone}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Agent: {tenant.agents?.profiles?.full_name || 'Unknown'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">UGX {Number(tenant.outstanding_balance || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Outstanding</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Agent Search Dialog */}
      <Dialog open={showAgentSearch} onOpenChange={setShowAgentSearch}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Agents</DialogTitle>
            <DialogDescription>
              Search for agents by name or phone number
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter agent name or phone number..."
                value={agentSearchQuery}
                onChange={(e) => setAgentSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAgentSearch();
                  }
                }}
              />
              <Button onClick={handleAgentSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">Search Results ({searchResults.length})</h3>
                {searchResults.map((agent: any) => (
                  <Card 
                    key={agent.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      navigate(`/manager/agents/${agent.id}`);
                      setShowAgentSearch(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{agent.profiles?.full_name || 'Unknown Agent'}</h4>
                          <p className="text-sm text-muted-foreground">{agent.profiles?.phone_number}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {agent.active_tenants || 0} active tenants
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{Number(agent.collection_rate || 0).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Collection Rate</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ManagerLayout>
  );
};

export default ManagerDashboard;

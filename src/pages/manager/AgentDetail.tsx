import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { AgentDetailSkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, User, Phone, DollarSign, TrendingUp, Users, Calendar, Award } from "lucide-react";
import { format } from "date-fns";
import { useRealtimeAgents, useRealtimeAllTenants, useRealtimeAllCollections, useRealtimeProfiles, registerSyncCallback } from "@/hooks/useRealtimeSubscription";

interface AgentData {
  id: string;
  user_id: string;
  active_tenants: number;
  total_tenants: number;
  collection_rate: number;
  monthly_earnings: number;
  portfolio_value: number;
  portfolio_limit: number;
  motorcycle_eligible: boolean;
  motorcycle_applied: boolean;
  profiles?: {
    full_name: string;
    phone_number: string;
  };
}

interface Tenant {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  rent_amount: number;
  outstanding_balance: number;
  status: string;
  last_payment_date: string | null;
  days_remaining: number;
}

interface Collection {
  id: string;
  amount: number;
  commission: number;
  payment_method: string;
  collection_date: string;
  status: string;
  tenants?: {
    tenant_name: string;
  };
}

const ManagerAgentDetail = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  // Enable real-time updates
  useRealtimeAgents();
  useRealtimeAllTenants();
  useRealtimeAllCollections();
  useRealtimeProfiles();

  const fetchAgentData = async () => {
    try {
      // Fetch agent details with profile
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number
          )
        `)
        .eq("id", agentId)
        .maybeSingle();

      if (agentError) throw agentError;
      if (!agentData) {
        toast.error("Agent not found");
        navigate("/manager/agents");
        return;
      }

      setAgent(agentData);

      // Fetch tenants for this agent
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Fetch collections for this agent
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("collections")
        .select(`
          *,
          tenants (
            tenant_name
          )
        `)
        .eq("agent_id", agentId)
        .order("collection_date", { ascending: false })
        .limit(50);

      if (collectionsError) throw collectionsError;
      setCollections(collectionsData || []);
    } catch (error: any) {
      toast.error("Failed to load agent details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();

    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'agents' || table === 'tenants' || table === 'collections' || table === 'profiles') {
        console.log(`Real-time update detected on ${table}, refreshing agent details`);
        fetchAgentData();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, [agentId]);

  if (loading) {
    return (
      <ManagerLayout currentPage="/manager/agents">
        <AgentDetailSkeleton />
      </ManagerLayout>
    );
  }

  if (!agent) {
    return (
      <ManagerLayout currentPage="/manager/agents">
        <div className="text-center py-8">Agent not found</div>
      </ManagerLayout>
    );
  }

  const totalCollected = collections
    .filter(c => c.status === "completed")
    .reduce((sum, c) => sum + parseFloat(c.amount?.toString() || '0'), 0);

  const totalCommissions = collections
    .filter(c => c.status === "completed")
    .reduce((sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 0);

  const portfolioProgress = (agent.portfolio_value / agent.portfolio_limit) * 100;
  const motorcycleProgress = (agent.active_tenants / 50) * 100;

  return (
    <ManagerLayout currentPage="/manager/agents">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/manager/agents")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{agent.profiles?.full_name || 'Unknown Agent'}</h1>
            <p className="text-muted-foreground">Agent Performance & Details</p>
          </div>
          <Badge variant={agent.active_tenants > 0 ? "default" : "secondary"}>
            {agent.active_tenants > 0 ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Performance Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agent.active_tenants} / {agent.total_tenants}</div>
              <p className="text-xs text-muted-foreground">Active / Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {parseFloat(agent.collection_rate?.toString() || '0').toFixed(0)}%
              </div>
              <p className={`text-xs ${parseFloat(agent.collection_rate?.toString() || '0') >= 95 ? 'text-success' : 'text-warning'}`}>
                {parseFloat(agent.collection_rate?.toString() || '0') >= 95 ? 'Excellent' : 'Needs Improvement'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {parseFloat(agent.monthly_earnings?.toString() || '0').toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">From commissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {parseFloat(agent.portfolio_value?.toString() || '0').toLocaleString()}
              </div>
              <div className="mt-2">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(portfolioProgress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {portfolioProgress.toFixed(0)}% of UGX {(agent.portfolio_limit / 1000000).toFixed(0)}M limit
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Motorcycle Progress Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Motorcycle Reward Progress
                </CardTitle>
                <CardDescription>
                  {agent.motorcycle_eligible 
                    ? agent.motorcycle_applied 
                      ? "Motorcycle application submitted!" 
                      : "Eligible for motorcycle reward!"
                    : `${50 - agent.active_tenants} more active tenants to qualify`}
                </CardDescription>
              </div>
              {agent.motorcycle_eligible && (
                <Badge variant="default" className="text-lg px-4 py-2">
                  {agent.motorcycle_applied ? "Applied" : "Eligible"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{agent.active_tenants} / 50 active tenants</span>
                <span className="font-semibold">{motorcycleProgress.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(motorcycleProgress, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{agent.profiles?.full_name || 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="font-medium">{agent.profiles?.phone_number || 'Not set'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Tenants and Payments */}
        <Tabs defaultValue="tenants" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tenants">
              <Users className="h-4 w-4 mr-2" />
              Tenants ({tenants.length})
            </TabsTrigger>
            <TabsTrigger value="payments">
              <DollarSign className="h-4 w-4 mr-2" />
              Payment History ({collections.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Portfolio</CardTitle>
                <CardDescription>All tenants managed by this agent</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Monthly Rent</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Days Left</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No tenants found
                          </TableCell>
                        </TableRow>
                      ) : (
                        tenants.map((tenant) => (
                          <TableRow 
                            key={tenant.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => navigate(`/manager/tenants/${tenant.id}`)}
                          >
                            <TableCell className="font-medium text-primary hover:underline">{tenant.tenant_name}</TableCell>
                            <TableCell>{tenant.tenant_phone}</TableCell>
                            <TableCell>UGX {parseFloat(tenant.rent_amount?.toString() || '0').toLocaleString()}</TableCell>
                            <TableCell>
                              <span className={parseFloat(tenant.outstanding_balance?.toString() || '0') > 0 ? "text-destructive font-medium" : ""}>
                                UGX {parseFloat(tenant.outstanding_balance?.toString() || '0').toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                tenant.status === 'verified' || tenant.status === 'paying' ? 'default' :
                                tenant.status === 'late' ? 'destructive' :
                                'secondary'
                              }>
                                {tenant.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{tenant.days_remaining} days</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>
                  Total collected: UGX {totalCollected.toLocaleString()} | 
                  Total commissions: UGX {totalCommissions.toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collections.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No payment records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        collections.map((collection) => (
                          <TableRow key={collection.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {format(new Date(collection.collection_date), "MMM d, yyyy")}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {collection.tenants?.tenant_name || 'Unknown'}
                            </TableCell>
                            <TableCell className="font-semibold">
                              UGX {parseFloat(collection.amount?.toString() || '0').toLocaleString()}
                            </TableCell>
                            <TableCell className="text-primary font-medium">
                              UGX {parseFloat(collection.commission?.toString() || '0').toLocaleString()}
                            </TableCell>
                            <TableCell className="capitalize">{collection.payment_method?.replace('_', ' ')}</TableCell>
                            <TableCell>
                              <Badge variant={
                                collection.status === 'completed' ? 'default' :
                                collection.status === 'failed' ? 'destructive' :
                                'secondary'
                              }>
                                {collection.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ManagerLayout>
  );
};

export default ManagerAgentDetail;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeAgents, useRealtimeAllTenants, useRealtimeProfiles, registerSyncCallback } from "@/hooks/useRealtimeSubscription";
import { ChevronLeft, ChevronRight, Users, TrendingUp, DollarSign, Bike } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AgentWithDetails {
  id: string;
  user_id: string;
  active_tenants: number | null;
  total_tenants: number | null;
  collection_rate: number | null;
  monthly_earnings: number | null;
  portfolio_value: number | null;
  portfolio_limit: number | null;
  motorcycle_eligible: boolean | null;
  motorcycle_applied: boolean | null;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string | null;
    phone_number: string;
    role: string;
  };
  tenant_count: number;
}

const ManagerAgents = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalAgents, setTotalAgents] = useState(0);
  
  // Enable real-time updates
  useRealtimeAgents();
  useRealtimeAllTenants();
  useRealtimeProfiles();

  const fetchAgents = async () => {
    try {
      // First get total count
      const { count } = await supabase
        .from("agents")
        .select("*", { count: "exact", head: true });

      setTotalAgents(count || 0);

      // Fetch paginated agents with all details
      const { data: agentsData, error: agentsError } = await supabase
        .from("agents")
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number,
            role
          )
        `)
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (agentsError) throw agentsError;

      // Fetch tenant counts for each agent
      const agentIds = agentsData?.map(a => a.id) || [];
      
      if (agentIds.length > 0) {
        const { data: tenantCounts, error: tenantsError } = await supabase
          .from("tenants")
          .select("agent_id")
          .in("agent_id", agentIds);

        if (tenantsError) throw tenantsError;

        // Count tenants per agent
        const tenantCountMap = (tenantCounts || []).reduce((acc: Record<string, number>, tenant) => {
          acc[tenant.agent_id] = (acc[tenant.agent_id] || 0) + 1;
          return acc;
        }, {});

        // Merge tenant counts with agent data
        const agentsWithCounts = (agentsData || []).map(agent => ({
          ...agent,
          tenant_count: tenantCountMap[agent.id] || 0,
        }));

        setAgents(agentsWithCounts);
      } else {
        setAgents([]);
      }
    } catch (error: any) {
      toast.error("Failed to load agents");
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [currentPage, pageSize]);

  useEffect(() => {
    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'agents' || table === 'profiles' || table === 'tenants') {
        console.log(`Real-time update detected on ${table}, refreshing agents list`);
        fetchAgents();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, [currentPage, pageSize]);

  const totalPages = Math.ceil(totalAgents / pageSize);
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalAgents);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <ManagerLayout currentPage="/manager/agents">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground">Monitor and manage all agents in your area</p>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => navigate("/manager/agents/compare")}
          >
            Compare Agents
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Agents</CardTitle>
            <CardDescription>
              Total: {totalAgents} agent{totalAgents !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead><Users className="h-4 w-4 inline mr-1" />Tenants</TableHead>
                    <TableHead><TrendingUp className="h-4 w-4 inline mr-1" />Collection Rate</TableHead>
                    <TableHead><DollarSign className="h-4 w-4 inline mr-1" />Monthly Earnings</TableHead>
                    <TableHead><DollarSign className="h-4 w-4 inline mr-1" />Portfolio Value</TableHead>
                    <TableHead><Bike className="h-4 w-4 inline mr-1" />Motorcycle</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Loading agents...
                      </TableCell>
                    </TableRow>
                  ) : agents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No agents found
                      </TableCell>
                    </TableRow>
                  ) : (
                    agents.map((agent) => (
                      <TableRow 
                        key={agent.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/manager/agents/${agent.id}`)}
                      >
                        <TableCell className="font-medium">
                          {agent.profiles?.full_name || 'Unknown Agent'}
                        </TableCell>
                        <TableCell>{agent.profiles?.phone_number || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {agent.tenant_count} tenant{agent.tenant_count !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={Number(agent.collection_rate || 0) >= 95 ? "text-green-600 font-medium" : "text-yellow-600"}>
                            {Number(agent.collection_rate || 0).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          UGX {Number(agent.monthly_earnings || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>UGX {Number(agent.portfolio_value || 0).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">
                              / {Number(agent.portfolio_limit || 0).toLocaleString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {agent.motorcycle_eligible ? (
                            agent.motorcycle_applied ? (
                              <Badge className="bg-green-600">Applied</Badge>
                            ) : (
                              <Badge className="bg-blue-600">Eligible</Badge>
                            )
                          ) : (
                            <Badge variant="secondary">Not Eligible</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={agent.tenant_count > 0 ? "default" : "secondary"}>
                            {agent.tenant_count > 0 ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {!loading && totalAgents > 0 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    Showing {startRecord} to {endRecord} of {totalAgents} agents
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default ManagerAgents;

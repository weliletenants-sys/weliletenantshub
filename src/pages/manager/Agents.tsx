import { useEffect, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeAgents, useRealtimeAllTenants, useRealtimeProfiles, registerSyncCallback } from "@/hooks/useRealtimeSubscription";

const ManagerAgents = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Enable real-time updates
  useRealtimeAgents();
  useRealtimeAllTenants();
  useRealtimeProfiles();

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agents")
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number
          )
        `);

      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    
    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'agents' || table === 'profiles') {
        console.log(`Real-time update detected on ${table}, refreshing agents list`);
        fetchAgents();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, []);

  return (
    <ManagerLayout currentPage="/manager/agents">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground">Monitor and manage all agents in your area</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Agents</CardTitle>
            <CardDescription>
              Total: {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Collection Rate</TableHead>
                    <TableHead>Monthly Earnings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading agents...
                      </TableCell>
                    </TableRow>
                  ) : agents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No agents found
                      </TableCell>
                    </TableRow>
                  ) : (
                    agents.map((agent) => (
                      <TableRow key={agent.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {agent.profiles?.full_name || 'Unknown Agent'}
                        </TableCell>
                        <TableCell>{agent.profiles?.phone_number || '-'}</TableCell>
                        <TableCell>
                          {agent.active_tenants} / {agent.total_tenants}
                        </TableCell>
                        <TableCell>
                          <span className={parseFloat(agent.collection_rate || '0') >= 95 ? "text-success" : "text-warning"}>
                            {parseFloat(agent.collection_rate || '0').toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>UGX {parseFloat(agent.monthly_earnings || '0').toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={agent.active_tenants > 0 ? "default" : "secondary"}>
                            {agent.active_tenants > 0 ? "active" : "inactive"}
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
      </div>
    </ManagerLayout>
  );
};

export default ManagerAgents;

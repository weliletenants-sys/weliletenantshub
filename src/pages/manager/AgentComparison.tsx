import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Users, TrendingUp, DollarSign, Award, Trophy, ChevronRight } from "lucide-react";
import { useRealtimeAgents, useRealtimeProfiles, registerSyncCallback } from "@/hooks/useRealtimeSubscription";

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
  profiles?: {
    full_name: string;
    phone_number: string;
  };
}

const ManagerAgentComparison = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Enable real-time updates
  useRealtimeAgents();
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
        `)
        .order("active_tenants", { ascending: false });

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
        console.log(`Real-time update detected on ${table}, refreshing agents`);
        fetchAgents();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, []);

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev => {
      if (prev.includes(agentId)) {
        return prev.filter(id => id !== agentId);
      } else {
        // Limit to 4 agents max for better comparison view
        if (prev.length >= 4) {
          toast.error("Maximum 4 agents can be compared at once");
          return prev;
        }
        return [...prev, agentId];
      }
    });
  };

  const selectedAgents = agents.filter(a => selectedAgentIds.includes(a.id));

  // Calculate rankings
  const topCollector = agents.reduce((prev, current) => 
    parseFloat(current.collection_rate?.toString() || '0') > parseFloat(prev.collection_rate?.toString() || '0') ? current : prev
  , agents[0]);

  const topEarner = agents.reduce((prev, current) => 
    parseFloat(current.monthly_earnings?.toString() || '0') > parseFloat(prev.monthly_earnings?.toString() || '0') ? current : prev
  , agents[0]);

  const topPortfolio = agents.reduce((prev, current) => 
    parseFloat(current.portfolio_value?.toString() || '0') > parseFloat(prev.portfolio_value?.toString() || '0') ? current : prev
  , agents[0]);

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
            <h1 className="text-3xl font-bold">Agent Comparison</h1>
            <p className="text-muted-foreground">
              Compare performance metrics across agents (select up to 4)
            </p>
          </div>
          <Badge variant="outline" className="text-base px-4 py-2">
            {selectedAgentIds.length} / 4 selected
          </Badge>
        </div>

        {/* Top Performers Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Top Collection Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-lg">{topCollector?.profiles?.full_name || 'N/A'}</p>
              <p className="text-2xl font-bold text-primary">
                {parseFloat(topCollector?.collection_rate?.toString() || '0').toFixed(0)}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Top Earner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-lg">{topEarner?.profiles?.full_name || 'N/A'}</p>
              <p className="text-2xl font-bold text-primary">
                UGX {parseFloat(topEarner?.monthly_earnings?.toString() || '0').toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Largest Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-lg">{topPortfolio?.profiles?.full_name || 'N/A'}</p>
              <p className="text-2xl font-bold text-primary">
                UGX {parseFloat(topPortfolio?.portfolio_value?.toString() || '0').toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Agent Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Agents to Compare</CardTitle>
            <CardDescription>Choose up to 4 agents for side-by-side comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <p className="text-center py-4 text-muted-foreground">Loading agents...</p>
              ) : agents.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No agents found</p>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedAgentIds.includes(agent.id)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleAgentSelection(agent.id)}
                  >
                    <Checkbox
                      checked={selectedAgentIds.includes(agent.id)}
                      onCheckedChange={() => toggleAgentSelection(agent.id)}
                    />
                    <div className="flex-1 grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="font-semibold">{agent.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{agent.profiles?.phone_number}</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground">Tenants</p>
                        <p className="font-semibold">{agent.active_tenants} / {agent.total_tenants}</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground">Collection Rate</p>
                        <p className="font-semibold">{parseFloat(agent.collection_rate?.toString() || '0').toFixed(0)}%</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground">Earnings</p>
                        <p className="font-semibold">UGX {parseFloat(agent.monthly_earnings?.toString() || '0').toLocaleString()}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comparison View */}
        {selectedAgents.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Performance Comparison</h2>
            
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${selectedAgents.length}, minmax(0, 1fr))` }}>
              {selectedAgents.map((agent) => {
                const portfolioProgress = (agent.portfolio_value / agent.portfolio_limit) * 100;
                const motorcycleProgress = (agent.active_tenants / 50) * 100;

                return (
                  <Card key={agent.id} className="border-2">
                    <CardHeader className="text-center bg-muted/50">
                      <CardTitle className="text-lg">{agent.profiles?.full_name || 'Unknown'}</CardTitle>
                      <CardDescription>{agent.profiles?.phone_number}</CardDescription>
                      <Badge 
                        variant={agent.active_tenants > 0 ? "default" : "secondary"}
                        className="mx-auto mt-2"
                      >
                        {agent.active_tenants > 0 ? "Active" : "Inactive"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      {/* Tenants */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Tenants</p>
                          </div>
                          <Badge variant="outline">{agent.active_tenants} / {agent.total_tenants}</Badge>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold">{agent.active_tenants}</p>
                          <p className="text-xs text-muted-foreground">Active Tenants</p>
                        </div>
                      </div>

                      {/* Collection Rate */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Collection Rate</p>
                          </div>
                          {agent.id === topCollector?.id && (
                            <Trophy className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold">
                            {parseFloat(agent.collection_rate?.toString() || '0').toFixed(0)}%
                          </p>
                          <p className={`text-xs ${parseFloat(agent.collection_rate?.toString() || '0') >= 95 ? 'text-success' : 'text-warning'}`}>
                            {parseFloat(agent.collection_rate?.toString() || '0') >= 95 ? 'Excellent' : 'Needs Improvement'}
                          </p>
                        </div>
                      </div>

                      {/* Earnings */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Monthly Earnings</p>
                          </div>
                          {agent.id === topEarner?.id && (
                            <Trophy className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">
                            UGX {parseFloat(agent.monthly_earnings?.toString() || '0').toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">From commissions</p>
                        </div>
                      </div>

                      {/* Portfolio Value */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Portfolio Value</p>
                          </div>
                          {agent.id === topPortfolio?.id && (
                            <Trophy className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="text-center mb-2">
                          <p className="text-2xl font-bold">
                            UGX {parseFloat(agent.portfolio_value?.toString() || '0').toLocaleString()}
                          </p>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(portfolioProgress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {portfolioProgress.toFixed(0)}% of limit
                        </p>
                      </div>

                      {/* Motorcycle Progress */}
                      <div className="space-y-2 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Motorcycle Progress</p>
                          {agent.motorcycle_eligible && (
                            <Badge variant="default" className="text-xs">Eligible</Badge>
                          )}
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(motorcycleProgress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {agent.active_tenants} / 50 tenants ({motorcycleProgress.toFixed(0)}%)
                        </p>
                      </div>

                      {/* View Details Button */}
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/manager/agents/${agent.id}`);
                        }}
                      >
                        View Full Profile
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {selectedAgents.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Agents Selected</h3>
              <p className="text-muted-foreground">
                Select agents from the list above to compare their performance metrics
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ManagerLayout>
  );
};

export default ManagerAgentComparison;

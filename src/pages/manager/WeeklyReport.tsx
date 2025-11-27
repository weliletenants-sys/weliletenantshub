import { useState, useEffect } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Award, AlertCircle, Calendar } from "lucide-react";
import { startOfWeek, endOfWeek, startOfWeek as prevWeekStart, endOfWeek as prevWeekEnd, subWeeks, format } from "date-fns";
import { useRealtimeAgents, useRealtimeAllCollections, useRealtimeProfiles, registerSyncCallback } from "@/hooks/useRealtimeSubscription";

interface AgentPerformance {
  id: string;
  name: string;
  collection_rate: number;
  monthly_earnings: number;
  portfolio_value: number;
  total_tenants: number;
  weekly_collections: number;
  prev_week_collections: number;
}

const ManagerWeeklyReport = () => {
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekRange, setWeekRange] = useState({ start: "", end: "" });

  useRealtimeAgents();
  useRealtimeAllCollections();
  useRealtimeProfiles();

  useEffect(() => {
    fetchWeeklyData();
  }, []);

  useEffect(() => {
    const unregister = registerSyncCallback((table) => {
      if (table === 'agents' || table === 'collections' || table === 'profiles') {
        fetchWeeklyData();
      }
    });
    return () => {
      unregister();
    };
  }, []);

  const fetchWeeklyData = async () => {
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const prevStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const prevEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

      setWeekRange({
        start: format(weekStart, 'MMM d'),
        end: format(weekEnd, 'MMM d, yyyy')
      });

      // Fetch agents with profiles
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select(`
          *,
          profiles!inner(full_name)
        `);

      if (agentsError) throw agentsError;

      // Fetch this week's collections
      const { data: thisWeekCollections, error: thisWeekError } = await supabase
        .from('collections')
        .select('agent_id, amount')
        .gte('collection_date', weekStart.toISOString())
        .lte('collection_date', weekEnd.toISOString());

      if (thisWeekError) throw thisWeekError;

      // Fetch previous week's collections
      const { data: prevWeekCollections, error: prevWeekError } = await supabase
        .from('collections')
        .select('agent_id, amount')
        .gte('collection_date', prevStart.toISOString())
        .lte('collection_date', prevEnd.toISOString());

      if (prevWeekError) throw prevWeekError;

      // Calculate weekly totals
      const thisWeekTotals = (thisWeekCollections || []).reduce((acc, col) => {
        acc[col.agent_id] = (acc[col.agent_id] || 0) + Number(col.amount);
        return acc;
      }, {} as Record<string, number>);

      const prevWeekTotals = (prevWeekCollections || []).reduce((acc, col) => {
        acc[col.agent_id] = (acc[col.agent_id] || 0) + Number(col.amount);
        return acc;
      }, {} as Record<string, number>);

      // Combine data
      const performanceData: AgentPerformance[] = (agentsData || []).map((agent: any) => ({
        id: agent.id,
        name: agent.profiles.full_name || 'Unknown',
        collection_rate: Number(agent.collection_rate || 0),
        monthly_earnings: Number(agent.monthly_earnings || 0),
        portfolio_value: Number(agent.portfolio_value || 0),
        total_tenants: agent.total_tenants || 0,
        weekly_collections: thisWeekTotals[agent.id] || 0,
        prev_week_collections: prevWeekTotals[agent.id] || 0,
      }));

      setAgents(performanceData);
    } catch (error) {
      console.error('Error fetching weekly data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const topPerformers = [...agents]
    .sort((a, b) => b.weekly_collections - a.weekly_collections)
    .slice(0, 3);

  const needSupport = [...agents]
    .filter(a => a.collection_rate < 70 || a.weekly_collections < a.prev_week_collections * 0.8)
    .sort((a, b) => a.collection_rate - b.collection_rate)
    .slice(0, 3);

  const getWeekOverWeekChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  if (isLoading) {
    return (
      <ManagerLayout currentPage="/manager/weekly-report">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/weekly-report">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Weekly Performance Report</h1>
            <p className="text-lg text-muted-foreground mt-1">
              {weekRange.start} - {weekRange.end}
            </p>
          </div>
        </div>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">Top Performers This Week</CardTitle>
            </div>
            <CardDescription className="text-base">
              Agents with highest collections this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topPerformers.length === 0 ? (
              <p className="text-muted-foreground text-base">No data available for this week</p>
            ) : (
              <div className="space-y-4">
                {topPerformers.map((agent, index) => {
                  const change = getWeekOverWeekChange(agent.weekly_collections, agent.prev_week_collections);
                  const isPositive = change >= 0;

                  return (
                    <div key={agent.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{agent.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {agent.total_tenants} tenants • {agent.collection_rate.toFixed(1)}% rate
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl">
                          UGX {agent.weekly_collections.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          {isPositive ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {Math.abs(change).toFixed(1)}% vs last week
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agents Needing Support */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-orange-500" />
              <CardTitle className="text-2xl">Agents Needing Support</CardTitle>
            </div>
            <CardDescription className="text-base">
              Agents with low collection rates or declining performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {needSupport.length === 0 ? (
              <p className="text-muted-foreground text-base">All agents are performing well! 🎉</p>
            ) : (
              <div className="space-y-4">
                {needSupport.map((agent) => {
                  const change = getWeekOverWeekChange(agent.weekly_collections, agent.prev_week_collections);
                  const isDecline = change < -20;

                  return (
                    <div key={agent.id} className="flex items-center justify-between p-4 border border-orange-200 dark:border-orange-900 rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                      <div>
                        <p className="font-semibold text-lg">{agent.name}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant={agent.collection_rate < 50 ? "destructive" : "secondary"}>
                            {agent.collection_rate.toFixed(1)}% collection rate
                          </Badge>
                          {isDecline && (
                            <Badge variant="destructive">
                              {Math.abs(change).toFixed(1)}% decline
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          UGX {agent.weekly_collections.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {agent.total_tenants} tenants
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Collections</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                UGX {agents.reduce((sum, a) => sum + a.weekly_collections, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-2">This week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Average Collection Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {agents.length > 0 
                  ? (agents.reduce((sum, a) => sum + a.collection_rate, 0) / agents.length).toFixed(1)
                  : 0}%
              </p>
              <p className="text-sm text-muted-foreground mt-2">Across all agents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {agents.filter(a => a.weekly_collections > 0).length}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Out of {agents.length} total
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ManagerLayout>
  );
};

export default ManagerWeeklyReport;

import { useEffect, useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import { WeeklySummarySkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

interface DailyCollection {
  date: string;
  amount: number;
  count: number;
}

interface OverduePattern {
  newOverdue: number;
  resolved: number;
  stillOverdue: number;
}

const WeeklySummary = () => {
  const [loading, setLoading] = useState(true);
  const [dailyCollections, setDailyCollections] = useState<DailyCollection[]>([]);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [previousWeekTotal, setPreviousWeekTotal] = useState(0);
  const [overduePattern, setOverduePattern] = useState<OverduePattern>({ newOverdue: 0, resolved: 0, stillOverdue: 0 });
  const [collectionRate, setCollectionRate] = useState(0);
  const [tenantStats, setTenantStats] = useState({ active: 0, total: 0 });

  useEffect(() => {
    fetchWeeklySummary();
  }, []);

  const fetchWeeklySummary = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agentData } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!agentData) return;

      // Get dates for this week and last week
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(today.getDate() - 14);

      // Fetch this week's collections
      const { data: thisWeekCollections } = await supabase
        .from('collections')
        .select('*')
        .eq('agent_id', agentData.id)
        .gte('collection_date', sevenDaysAgo.toISOString().split('T')[0])
        .lte('collection_date', today.toISOString().split('T')[0]);

      // Fetch last week's collections
      const { data: lastWeekCollections } = await supabase
        .from('collections')
        .select('amount')
        .eq('agent_id', agentData.id)
        .gte('collection_date', fourteenDaysAgo.toISOString().split('T')[0])
        .lt('collection_date', sevenDaysAgo.toISOString().split('T')[0]);

      // Calculate daily collections
      const dailyData: { [key: string]: { amount: number; count: number } } = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyData[dateStr] = { amount: 0, count: 0 };
      }

      let thisWeekTotal = 0;
      (thisWeekCollections || []).forEach(collection => {
        const date = collection.collection_date;
        if (dailyData[date]) {
          dailyData[date].amount += collection.amount;
          dailyData[date].count += 1;
        }
        thisWeekTotal += collection.amount;
      });

      const lastWeekTotal = (lastWeekCollections || []).reduce((sum, c) => sum + c.amount, 0);

      const chartData = Object.entries(dailyData).map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        amount: data.amount,
        count: data.count,
      }));

      // Fetch overdue patterns
      const { data: allTenants } = await supabase
        .from('tenants')
        .select('*')
        .eq('agent_id', agentData.id)
        .eq('status', 'active');

      let newOverdue = 0;
      let resolved = 0;
      let stillOverdue = 0;

      (allTenants || []).forEach(tenant => {
        const nextDate = new Date(tenant.next_payment_date || '');
        const daysOverdue = Math.floor((today.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysOverdue > 0 && daysOverdue <= 7) {
          newOverdue++;
        } else if (daysOverdue > 7) {
          stillOverdue++;
        }
      });

      // Check resolved (paid within last 7 days)
      const recentPayers = (thisWeekCollections || []).reduce((acc, c) => {
        acc.add(c.tenant_id);
        return acc;
      }, new Set()).size;
      resolved = recentPayers;

      setDailyCollections(chartData);
      setWeeklyTotal(thisWeekTotal);
      setPreviousWeekTotal(lastWeekTotal);
      setOverduePattern({ newOverdue, resolved, stillOverdue });
      setCollectionRate(agentData.collection_rate || 0);
      setTenantStats({ active: agentData.active_tenants || 0, total: agentData.total_tenants || 0 });
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const percentageChange = previousWeekTotal > 0 
    ? ((weeklyTotal - previousWeekTotal) / previousWeekTotal * 100).toFixed(1)
    : '0';

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const overdueChartData = [
    { name: 'Resolved', value: overduePattern.resolved },
    { name: 'New Overdue', value: overduePattern.newOverdue },
    { name: 'Still Overdue', value: overduePattern.stillOverdue },
  ];

  if (loading) {
    return (
      <AgentLayout currentPage="/agent/weekly-summary">
        <WeeklySummarySkeleton />
      </AgentLayout>
    );
  }

  return (
    <AgentLayout currentPage="/agent/weekly-summary">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Weekly Summary Report</h1>
          <p className="text-muted-foreground">Last 7 days performance and trends</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collections</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">UGX {weeklyTotal.toLocaleString()}</div>
              <div className="flex items-center gap-1 text-xs">
                {parseFloat(percentageChange) >= 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-success">+{percentageChange}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">{percentageChange}%</span>
                  </>
                )}
                <span className="text-muted-foreground">vs last week</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{collectionRate.toFixed(1)}%</div>
              <Badge variant={collectionRate >= 95 ? "default" : "destructive"} className="mt-1">
                {collectionRate >= 95 ? "Excellent" : "Needs Attention"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenantStats.active}</div>
              <p className="text-xs text-muted-foreground">of {tenantStats.total} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{overduePattern.newOverdue}</div>
              <p className="text-xs text-muted-foreground">This week</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Collections Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Collections Trend</CardTitle>
            <CardDescription>Amount collected each day this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyCollections}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => `UGX ${value.toLocaleString()}`}
                  labelFormatter={(label) => `Day: ${label}`}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Overdue Patterns */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Overdue Payment Patterns</CardTitle>
              <CardDescription>Breakdown of overdue accounts this week</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={overdueChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {overdueChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Collection Insights</CardTitle>
              <CardDescription>Key takeaways from this week</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                {parseFloat(percentageChange) >= 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    {parseFloat(percentageChange) >= 0 ? 'Collections Increased' : 'Collections Decreased'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {parseFloat(percentageChange) >= 0 
                      ? `You collected ${Math.abs(parseFloat(percentageChange))}% more than last week. Great work!`
                      : `Collections dropped by ${Math.abs(parseFloat(percentageChange))}%. Follow up on overdue accounts.`
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {overduePattern.resolved > overduePattern.newOverdue ? (
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                )}
                <div>
                  <p className="font-medium">Overdue Recovery</p>
                  <p className="text-sm text-muted-foreground">
                    {overduePattern.resolved} accounts resolved, {overduePattern.newOverdue} became overdue this week
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {collectionRate >= 95 ? (
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div>
                  <p className="font-medium">Collection Rate</p>
                  <p className="text-sm text-muted-foreground">
                    {collectionRate >= 95 
                      ? `Excellent ${collectionRate.toFixed(1)}% rate - keep it up!`
                      : `At ${collectionRate.toFixed(1)}%, focus on improving follow-ups.`
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AgentLayout>
  );
};

export default WeeklySummary;

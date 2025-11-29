import AgentLayout from "@/components/AgentLayout";
import { EarningsSkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Wallet, Target, DollarSign, Award, Calendar, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AgentEarnings = () => {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState({
    thisMonth: 0,
    lastMonth: 0,
    walletBalance: 0,
    portfolioValue: 0,
    portfolioLimit: 20000000,
    collectionRate: 0,
    lifetimeCommission: 0,
    totalPayments: 0,
    averageCommission: 0,
    lastThreeMonths: 0,
  });
  const [recentCollections, setRecentCollections] = useState<any[]>([]);

  useEffect(() => {
    fetchEarningsData();
  }, []);

  const fetchEarningsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agentData } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!agentData) return;

      // Get current month's collections
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const { data: thisMonthCollections } = await supabase
        .from('collections')
        .select('amount, commission, collection_date, tenants(tenant_name)')
        .eq('agent_id', agentData.id)
        .gte('collection_date', firstDayThisMonth.toISOString().split('T')[0])
        .order('collection_date', { ascending: false });

      const { data: lastMonthCollections } = await supabase
        .from('collections')
        .select('commission')
        .eq('agent_id', agentData.id)
        .gte('collection_date', firstDayLastMonth.toISOString().split('T')[0])
        .lte('collection_date', lastDayLastMonth.toISOString().split('T')[0]);

      // Get lifetime commission data
      const { data: allCollections } = await supabase
        .from('collections')
        .select('commission')
        .eq('agent_id', agentData.id)
        .eq('status', 'verified');

      // Get last 3 months data for trend comparison
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const { data: lastThreeMonthsCollections } = await supabase
        .from('collections')
        .select('commission')
        .eq('agent_id', agentData.id)
        .eq('status', 'verified')
        .gte('collection_date', threeMonthsAgo.toISOString().split('T')[0]);

      const thisMonthTotal = (thisMonthCollections || []).reduce((sum, c) => sum + c.commission, 0);
      const lastMonthTotal = (lastMonthCollections || []).reduce((sum, c) => sum + c.commission, 0);
      const lifetimeTotal = (allCollections || []).reduce((sum, c) => sum + c.commission, 0);
      const lastThreeMonthsTotal = (lastThreeMonthsCollections || []).reduce((sum, c) => sum + c.commission, 0);
      const totalPaymentCount = allCollections?.length || 0;
      const avgCommission = totalPaymentCount > 0 ? lifetimeTotal / totalPaymentCount : 0;

      setEarnings({
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        walletBalance: agentData.monthly_earnings || 0,
        portfolioValue: agentData.portfolio_value || 0,
        portfolioLimit: agentData.portfolio_limit || 20000000,
        collectionRate: agentData.collection_rate || 0,
        lifetimeCommission: lifetimeTotal,
        totalPayments: totalPaymentCount,
        averageCommission: avgCommission,
        lastThreeMonths: lastThreeMonthsTotal,
      });

      setRecentCollections(thisMonthCollections?.slice(0, 10) || []);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const growthRate = earnings.lastMonth > 0 
    ? ((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth * 100).toFixed(1)
    : '0';

  const threeMonthAverage = earnings.lastThreeMonths / 3;
  const vsThreeMonthAverage = threeMonthAverage > 0
    ? ((earnings.thisMonth - threeMonthAverage) / threeMonthAverage * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <AgentLayout currentPage="/agent/earnings">
        <EarningsSkeleton />
      </AgentLayout>
    );
  }

  return (
    <AgentLayout currentPage="/agent/earnings">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Earnings & Portfolio</h1>
          <p className="text-muted-foreground">Track your income and portfolio growth</p>
        </div>

        {/* Lifetime Commission Hero Card */}
        <Card className="bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-500 text-white overflow-hidden relative shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />
          
          <CardContent className="p-8 relative z-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/25 backdrop-blur-sm rounded-2xl">
                  <Award className="h-10 w-10" />
                </div>
                <div>
                  <p className="text-sm font-medium opacity-95 mb-1">🏆 Lifetime Commission</p>
                  <h2 className="text-5xl font-black tracking-tight">
                    UGX {earnings.lifetimeCommission.toLocaleString()}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-xs opacity-90 mb-1 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Total Payments
                  </p>
                  <p className="text-2xl font-bold">{earnings.totalPayments}</p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-xs opacity-90 mb-1 flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Avg/Payment
                  </p>
                  <p className="text-2xl font-bold">
                    {(earnings.averageCommission / 1000).toFixed(1)}K
                  </p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-xs opacity-90 mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last 3 Months
                  </p>
                  <p className="text-2xl font-bold">
                    {(earnings.lastThreeMonths / 1000).toFixed(0)}K
                  </p>
                </div>
              </div>

              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium opacity-95">Growth Trend</p>
                  {parseFloat(vsThreeMonthAverage) >= 0 ? (
                    <div className="flex items-center gap-1 bg-green-500/30 px-2 py-1 rounded-full">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-bold">+{vsThreeMonthAverage}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-red-500/30 px-2 py-1 rounded-full">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm font-bold">{vsThreeMonthAverage}%</span>
                    </div>
                  )}
                </div>
                <p className="text-xs opacity-90">
                  vs 3-month average (UGX {threeMonthAverage.toLocaleString()}/month)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Wallet Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {earnings.walletBalance.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Available for withdrawal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {earnings.thisMonth.toLocaleString()}
              </div>
              <p className="text-xs text-success mt-1">
                +{growthRate}% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Last Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {earnings.lastMonth.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Previous earnings</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Health</CardTitle>
            <CardDescription>
              Maintain 95%+ collection rate to keep your UGX 20M limit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Portfolio Usage</span>
                <span className="font-medium">
                  UGX {earnings.portfolioValue.toLocaleString()} / {earnings.portfolioLimit.toLocaleString()}
                </span>
              </div>
              <Progress value={(earnings.portfolioValue / earnings.portfolioLimit) * 100} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Collection Rate</span>
                <span className="font-bold text-success">{earnings.collectionRate.toFixed(1)}%</span>
              </div>
              <Progress value={earnings.collectionRate} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {earnings.collectionRate >= 95 
                  ? "Excellent! Keep it up to maintain your limit." 
                  : "Warning: Below 95%. Focus on collections to maintain your portfolio limit."}
              </p>
            </div>
          </CardContent>
        </Card>

        {recentCollections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Collections This Month</CardTitle>
              <CardDescription>Your latest commission earnings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                 {recentCollections.map((collection, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{collection.tenants?.tenant_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(collection.collection_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Payment: UGX {collection.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success text-lg">+UGX {collection.commission.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Commission (5%)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {((collection.commission / collection.amount) * 100).toFixed(1)}% of payment
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AgentLayout>
  );
};

export default AgentEarnings;

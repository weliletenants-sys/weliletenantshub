import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import AgentLayout from "@/components/AgentLayout";
import { DashboardSkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Bike, TrendingUp, Users, DollarSign, AlertCircle, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import QuickPaymentDialog from "@/components/QuickPaymentDialog";
import { clearOldCaches, getCacheSize } from "@/lib/cacheManager";
import { useServiceWorker } from "@/hooks/useServiceWorker";

const AgentDashboard = () => {
  const navigate = useNavigate();
  const [agentData, setAgentData] = useState<any>(null);
  const [todaysCollections, setTodaysCollections] = useState(0);
  const [todaysTarget, setTodaysTarget] = useState(0);
  const [tenantsDueToday, setTenantsDueToday] = useState(0);
  const [overdueTenants, setOverdueTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [verifiedPayments, setVerifiedPayments] = useState(0);
  const [rejectedPayments, setRejectedPayments] = useState(0);
  
  // Service worker for caching
  useServiceWorker();

  useEffect(() => {
    fetchAgentData();
    
    // Initialize cache management
    const initCache = async () => {
      await clearOldCaches();
      
      // Log cache size for monitoring
      const cacheSize = await getCacheSize();
      if (cacheSize) {
        console.log(`Cache usage: ${(cacheSize.usage / 1024 / 1024).toFixed(2)}MB / ${(cacheSize.quota / 1024 / 1024).toFixed(2)}MB (${cacheSize.percentage.toFixed(1)}%)`);
      }
    };
    
    initCache();
  }, []);

  // Show overdue notification on dashboard load
  useEffect(() => {
    if (overdueTenants.length > 0 && !isLoading) {
      const totalOverdue = overdueTenants.reduce((sum, t) => sum + (t.outstanding_balance || 0), 0);
      const mostOverdue = Math.max(...overdueTenants.map(t => t.daysOverdue));
      
      toast.error("⚠️ Overdue Payments Alert", {
        description: `${overdueTenants.length} tenant${overdueTenants.length > 1 ? 's' : ''} overdue • ${mostOverdue} days max • UGX ${totalOverdue.toLocaleString()} owed`,
        duration: 8000,
      });
    }
  }, [overdueTenants, isLoading]);

  const fetchAgentData = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agent, error } = await supabase
        .from("agents")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching agent data:", error);
        toast.error("Failed to load dashboard data");
        return;
      }

      if (!agent) {
        toast.error("Agent profile not found. Please contact support.");
        return;
      }

      setAgentData(agent);

      const today = new Date().toISOString().split('T')[0];

      // Calculate today's collections
      const { data: collections } = await supabase
        .from("collections")
        .select("amount")
        .eq("agent_id", agent.id)
        .eq("collection_date", today);

      const total = collections?.reduce((sum, col) => sum + parseFloat(col.amount.toString()), 0) || 0;
      setTodaysCollections(total);

      // Get tenants due today
      const { data: dueTenantsData } = await supabase
        .from("tenants")
        .select("rent_amount")
        .eq("agent_id", agent.id)
        .eq("next_payment_date", today)
        .eq("status", "verified");

      const dueCount = dueTenantsData?.length || 0;
      const target = dueTenantsData?.reduce((sum, tenant) => sum + parseFloat(tenant.rent_amount?.toString() || '0'), 0) || 0;
      
      setTenantsDueToday(dueCount);
      setTodaysTarget(target);

      // Fetch overdue tenants
      const { data: overdueData } = await supabase
        .from("tenants")
        .select("id, tenant_name, next_payment_date, outstanding_balance")
        .eq("agent_id", agent.id)
        .lt("next_payment_date", today)
        .in("status", ["verified", "active"])
        .order("next_payment_date", { ascending: true });

      if (overdueData) {
        const overdueWithDays = overdueData.map(tenant => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - new Date(tenant.next_payment_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          return { ...tenant, daysOverdue };
        });
        setOverdueTenants(overdueWithDays);
      }

      // Fetch payment verification stats
      const { data: pendingData } = await supabase
        .from("collections")
        .select("id")
        .eq("agent_id", agent.id)
        .eq("status", "pending");
      
      const { data: verifiedData } = await supabase
        .from("collections")
        .select("id")
        .eq("agent_id", agent.id)
        .eq("status", "verified");
      
      const { data: rejectedData } = await supabase
        .from("collections")
        .select("id")
        .eq("agent_id", agent.id)
        .eq("status", "rejected");

      setPendingVerifications(pendingData?.length || 0);
      setVerifiedPayments(verifiedData?.length || 0);
      setRejectedPayments(rejectedData?.length || 0);
    } catch (error: any) {
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    haptics.refresh();
    await fetchAgentData();
    toast.success("Dashboard refreshed");
  };

  const portfolioPercentage = agentData ? (agentData.portfolio_value / agentData.portfolio_limit) * 100 : 0;
  const tenantsToMotorcycle = Math.max(0, 50 - (agentData?.active_tenants || 0));

  if (isLoading) {
    return (
      <AgentLayout currentPage="/agent/dashboard">
        <DashboardSkeleton />
      </AgentLayout>
    );
  }

  return (
    <AgentLayout currentPage="/agent/dashboard">
      <PullToRefresh onRefresh={handleRefresh} pullingContent="">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your overview</p>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              size="lg" 
              className="text-lg font-bold shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate("/agent/new-tenant")}
            >
              <Plus className="h-6 w-6 mr-2" />
              Add New Tenant
            </Button>
            
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg font-bold shadow-lg hover:shadow-xl transition-all"
              onClick={() => setQuickPaymentOpen(true)}
            >
              <Zap className="h-6 w-6 mr-2" />
              Quick Payment
            </Button>
          </div>

          <QuickPaymentDialog
            open={quickPaymentOpen}
            onOpenChange={setQuickPaymentOpen}
            onSuccess={fetchAgentData}
          />

          {/* Overdue Payment Notifications */}
          {overdueTenants.length > 0 && (
            <Card className="border-2 border-destructive bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Overdue Payments ({overdueTenants.length})
                </CardTitle>
                <CardDescription>
                  These tenants have missed their payment deadline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueTenants.slice(0, 5).map((tenant) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-4 bg-background rounded-lg border border-destructive/20 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => navigate(`/agent/tenants/${tenant.id}`)}
                    >
                      <div>
                        <p className="font-semibold text-base">{tenant.tenant_name}</p>
                        <p className="text-sm text-destructive font-medium">
                          {tenant.daysOverdue} day{tenant.daysOverdue !== 1 ? 's' : ''} overdue
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-destructive text-lg">
                          UGX {(tenant.outstanding_balance || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                      </div>
                    </div>
                  ))}
                  {overdueTenants.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => navigate("/agent/tenants")}
                    >
                      View All {overdueTenants.length} Overdue Tenants
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        {/* Portfolio Value Hero Section */}
        <Card className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
          <CardContent className="p-8 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <TrendingUp className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm opacity-90 font-medium">Your Portfolio Capacity</p>
                  <h2 className="text-4xl font-bold tracking-tight">
                    UGX {(agentData?.portfolio_value || 0).toLocaleString()}
                  </h2>
                </div>
              </div>
              
              <div className="space-y-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm opacity-90">Target Portfolio Limit</p>
                    <p className="text-3xl font-bold">UGX 20,000,000</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Remaining Capacity</p>
                    <p className="text-2xl font-bold">
                      UGX {((agentData?.portfolio_limit || 20000000) - (agentData?.portfolio_value || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Progress value={portfolioPercentage} className="h-4 bg-white/20" />
                <div className="flex justify-between text-sm">
                  <span className="opacity-90">{portfolioPercentage.toFixed(1)}% utilized</span>
                  <span className="font-semibold">{(100 - portfolioPercentage).toFixed(1)}% available to grow</span>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border-2 border-white/30">
                <p className="text-lg font-semibold">
                  💡 You can add up to{" "}
                  <span className="text-2xl font-bold">
                    {Math.floor(((agentData?.portfolio_limit || 20000000) - (agentData?.portfolio_value || 0)) / 100000)}
                  </span>{" "}
                  more tenants!
                </p>
                <p className="text-sm opacity-90 mt-1">
                  Each new tenant grows your income and brings you closer to your goals
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Motorcycle Countdown Banner */}
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Bike className="h-12 w-12 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Motorcycle Reward Program</h3>
                <p className="text-lg mb-3">
                  You have <span className="font-bold">{agentData?.active_tenants || 0}</span> active tenants
                </p>
                {tenantsToMotorcycle > 0 ? (
                  <p className="text-xl">
                    Only <span className="font-bold text-3xl">{tenantsToMotorcycle}</span> more tenants to qualify for your FREE motorcycle on pay-as-you-go!
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xl font-bold">🎉 You've qualified for the motorcycle program!</p>
                    <Button variant="secondary" size="lg" className="mt-2">
                      Apply for Motorcycle
                    </Button>
                  </div>
                )}
                <Progress value={(agentData?.active_tenants || 0) * 2} className="mt-4 h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Collection Target */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Collection Goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">Collected</p>
                <div className="text-2xl font-bold text-success">
                  UGX {todaysCollections.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Target</p>
                <div className="text-2xl font-bold">
                  UGX {todaysTarget.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Progress 
                value={todaysTarget > 0 ? (todaysCollections / todaysTarget) * 100 : 0} 
                className="h-3"
              />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {todaysTarget > 0 ? Math.round((todaysCollections / todaysTarget) * 100) : 0}% achieved
                </span>
                <span className="font-semibold text-primary">
                  UGX {Math.max(0, todaysTarget - todaysCollections).toLocaleString()} remaining
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenants Needing Collection */}
        <Card className="border-2 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Collections Due Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{tenantsDueToday}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {tenantsDueToday === 0 ? 'No collections due' : tenantsDueToday === 1 ? 'tenant needs collection' : 'tenants need collection'}
            </p>
            {tenantsDueToday > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                onClick={() => navigate("/agent/collections")}
              >
                View Due Tenants
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agentData?.total_tenants || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {agentData?.active_tenants || 0} active
              </p>
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
                UGX {(agentData?.monthly_earnings || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total earnings</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Verification Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Verification Status</CardTitle>
            <CardDescription>
              Track your payment submissions and approvals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="text-3xl font-bold text-orange-500">{pendingVerifications}</div>
                <p className="text-sm text-muted-foreground mt-2">Pending Review</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-success/10 border border-success/20">
                <div className="text-3xl font-bold text-success">{verifiedPayments}</div>
                <p className="text-sm text-muted-foreground mt-2">Verified</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="text-3xl font-bold text-destructive">{rejectedPayments}</div>
                <p className="text-sm text-muted-foreground mt-2">Rejected</p>
              </div>
            </div>
            {pendingVerifications > 0 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                {pendingVerifications} payment{pendingVerifications !== 1 ? 's' : ''} awaiting manager verification
              </p>
            )}
          </CardContent>
        </Card>

        {/* Collection Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Collection Performance</CardTitle>
            <CardDescription>
              Maintain 95%+ collection rate to keep your UGX 20M portfolio limit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Collection Rate</span>
                <span className="font-bold">{agentData?.collection_rate || 0}%</span>
              </div>
              <Progress value={agentData?.collection_rate || 0} className="h-3" />
              {(agentData?.collection_rate || 0) < 95 && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg mt-4">
                  <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-warning-foreground">
                    Your collection rate is below 95%. Focus on collecting payments to maintain your portfolio limit.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </PullToRefresh>
    </AgentLayout>
  );
};

export default AgentDashboard;

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import AgentLayout from "@/components/AgentLayout";
import { DashboardSkeleton } from "@/components/TenantDetailSkeleton";
import { ContentTransition, SlideUpTransition } from "@/components/ContentTransition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Bike, TrendingUp, Users, DollarSign, AlertCircle, Plus, Zap, ArrowUp, ArrowDown, Minus, Bell, MessageSquare, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import QuickPaymentDialog from "@/components/QuickPaymentDialog";
import { clearOldCaches, getCacheSize } from "@/lib/cacheManager";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { format } from "date-fns";

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
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<any[]>([]);
  const [managerNotifications, setManagerNotifications] = useState<any[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const [previousNotificationCount, setPreviousNotificationCount] = useState(0);
  
  // Ref for auto-scroll to manager messages
  const managerMessagesRef = useRef<HTMLDivElement>(null);
  
  // Service worker for caching
  useServiceWorker();

  useEffect(() => {
    fetchAgentData();
    fetchManagerNotifications();
    
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

    // Set up realtime subscription for notifications
    const channel = supabase
      .channel("dashboard-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchManagerNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Fetch payment method breakdown (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

      // Current period (last 30 days)
      const { data: currentPeriodData } = await supabase
        .from("collections")
        .select("payment_method, amount")
        .eq("agent_id", agent.id)
        .gte("collection_date", thirtyDaysAgoStr)
        .eq("status", "verified");

      // Previous period (30-60 days ago)
      const { data: previousPeriodData } = await supabase
        .from("collections")
        .select("payment_method, amount")
        .eq("agent_id", agent.id)
        .gte("collection_date", sixtyDaysAgoStr)
        .lt("collection_date", thirtyDaysAgoStr)
        .eq("status", "verified");

      // Calculate totals by payment method
      const methodTotals: { [key: string]: { current: number; previous: number } } = {
        cash: { current: 0, previous: 0 },
        mtn: { current: 0, previous: 0 },
        airtel: { current: 0, previous: 0 },
      };

      currentPeriodData?.forEach(item => {
        const method = item.payment_method || 'cash';
        if (methodTotals[method]) {
          methodTotals[method].current += parseFloat(item.amount.toString());
        }
      });

      previousPeriodData?.forEach(item => {
        const method = item.payment_method || 'cash';
        if (methodTotals[method]) {
          methodTotals[method].previous += parseFloat(item.amount.toString());
        }
      });

      // Build chart data with trends
      const breakdownData = Object.entries(methodTotals).map(([method, totals]) => {
        const trendPercent = totals.previous > 0 
          ? ((totals.current - totals.previous) / totals.previous) * 100 
          : totals.current > 0 ? 100 : 0;
        
        return {
          method: method === 'cash' ? 'Cash' : method === 'mtn' ? 'MTN' : 'Airtel',
          amount: totals.current,
          trend: trendPercent,
          trendIcon: trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'neutral',
          color: method === 'cash' ? 'hsl(var(--success))' : method === 'mtn' ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
        };
      });

      setPaymentMethodBreakdown(breakdownData);
    } catch (error: any) {
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    haptics.refresh();
    await fetchAgentData();
    await fetchManagerNotifications();
    toast.success("Dashboard refreshed");
  };

  const fetchManagerNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          profiles!notifications_sender_id_fkey (
            full_name
          )
        `)
        .eq("recipient_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const filteredData = (data || []).filter(n => !dismissedNotifications.includes(n.id));
      const newCount = filteredData.length;
      
      // Auto-scroll to manager messages if new notifications arrived
      if (newCount > previousNotificationCount && previousNotificationCount > 0 && !isLoading) {
        setTimeout(() => {
          managerMessagesRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
          haptics.success(); // Haptic feedback for new message
          toast.success("📬 New message from manager!", {
            description: "Scroll up to view",
            duration: 3000,
          });
        }, 300);
      }
      
      setPreviousNotificationCount(newCount);
      setManagerNotifications(filteredData);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const handleDismissNotification = async (notificationId: string) => {
    setDismissedNotifications(prev => [...prev, notificationId]);
    
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "border-destructive bg-destructive/10";
      case "high":
        return "border-orange-500 bg-orange-50 dark:bg-orange-950";
      case "low":
        return "border-muted bg-muted/30";
      default:
        return "border-primary bg-primary/10";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
      case "high":
        return "🔴";
      case "low":
        return "🔵";
      default:
        return "📩";
    }
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
        <ContentTransition
          loading={isLoading}
          skeleton={<DashboardSkeleton />}
        >
          <div className="space-y-6 animate-reveal">
            <div className="mb-4">
              <h1 className="text-2xl font-bold">Dashboard 📊</h1>
              <p className="text-sm text-muted-foreground">Your stats at a glance</p>
            </div>

          {/* Manager Messages - HIGHLY PROMINENT DISPLAY */}
          {managerNotifications.length > 0 && (
            <Card 
              ref={managerMessagesRef}
              className="border-4 border-primary bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 shadow-2xl animate-pulse-slow scroll-mt-4"
            >
              <CardHeader className="pb-4 bg-primary/10 rounded-t-lg border-b-2 border-primary/30">
                <CardTitle className="flex items-center gap-3 text-primary text-2xl font-bold">
                  <div className="relative">
                    <MessageSquare className="h-8 w-8 animate-bounce" />
                    <div className="absolute -top-1 -right-1 h-5 w-5 bg-destructive rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{managerNotifications.length}</span>
                    </div>
                  </div>
                  Manager Messages
                </CardTitle>
                <CardDescription className="text-sm font-medium">
                  📢 Important updates from your manager - Read now!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {managerNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`relative ${getPriorityColor(notification.priority)} border-3 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 h-8 w-8 z-10 hover:bg-destructive/20"
                      onClick={() => handleDismissNotification(notification.id)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <CardContent className="p-5 pr-12">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl flex-shrink-0">{getPriorityIcon(notification.priority)}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xl mb-2 leading-tight">{notification.title}</h4>
                          <p className="text-base whitespace-pre-wrap mb-3 leading-relaxed">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                              👤 {notification.profiles?.full_name || "Manager"}
                            </Badge>
                            <span className="text-sm text-muted-foreground font-medium">
                              🕐 {format(new Date(notification.created_at), "MMM d, h:mm a")}
                            </span>
                            {notification.read_at && (
                              <Badge variant="secondary" className="text-xs px-2 py-1">
                                ✓ Read {format(new Date(notification.read_at), "MMM d, h:mm a")}
                              </Badge>
                            )}
                            {notification.priority !== "normal" && (
                              <Badge className={`text-sm font-bold px-3 py-1 ${
                                notification.priority === "urgent" 
                                  ? "bg-destructive animate-pulse"
                                  : notification.priority === "high"
                                  ? "bg-orange-500"
                                  : "bg-muted"
                              }`}>
                                {notification.priority === "urgent" && "🚨 "}
                                {notification.priority.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="default"
                  size="lg"
                  className="w-full text-base font-bold shadow-lg"
                  onClick={() => {
                    // Open notifications panel - this will be handled by clicking the bell icon
                    document.querySelector('[data-notification-trigger]')?.dispatchEvent(new Event('click'));
                  }}
                >
                  <Bell className="h-5 w-5 mr-2" />
                  View All Notifications
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              size="lg" 
              className="h-24 text-base font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
              onClick={() => navigate("/agent/new-tenant")}
            >
              <div className="flex flex-col items-center gap-1">
                <Plus className="h-8 w-8" />
                <span>Add Tenant</span>
              </div>
            </Button>
            
            <Button 
              size="lg" 
              variant="secondary"
              className="h-24 text-base font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
              onClick={() => setQuickPaymentOpen(true)}
            >
              <div className="flex flex-col items-center gap-1">
                <Zap className="h-8 w-8" />
                <span>Quick Pay</span>
              </div>
            </Button>
          </div>

          <QuickPaymentDialog
            open={quickPaymentOpen}
            onOpenChange={setQuickPaymentOpen}
            onSuccess={fetchAgentData}
          />

          {/* Overdue Payment Notifications */}
          {overdueTenants.length > 0 && (
            <Card className="border-2 border-destructive bg-destructive/5 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-destructive text-base">
                  ⚠️ Overdue ({overdueTenants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueTenants.slice(0, 3).map((tenant) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-3 bg-background rounded-xl border border-destructive/20 cursor-pointer hover:bg-accent/50 active:scale-98 transition-all"
                      onClick={() => navigate(`/agent/tenants/${tenant.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{tenant.tenant_name}</p>
                        <p className="text-sm text-destructive font-medium">
                          {tenant.daysOverdue}d overdue
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-destructive">
                          {((tenant.outstanding_balance || 0) / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  ))}
                  {overdueTenants.length > 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => navigate("/agent/tenants")}
                    >
                      See All {overdueTenants.length} ⚡
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        {/* Portfolio Value Hero Section */}
        <Card className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground overflow-hidden relative hover:shadow-xl transition-shadow">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
          <CardContent className="p-6 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                  <TrendingUp className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs opacity-90">💼 Your Portfolio</p>
                  <h2 className="text-3xl font-bold tracking-tight">
                    {(agentData?.portfolio_value / 1000000 || 0).toFixed(1)}M
                  </h2>
                </div>
              </div>
              
              <div className="space-y-2 bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-90">Target: 20M</span>
                  <span className="text-sm font-bold">{portfolioPercentage.toFixed(0)}%</span>
                </div>
                <Progress value={portfolioPercentage} className="h-3 bg-white/20" />
                <p className="text-xs opacity-90">
                  {((agentData?.portfolio_limit || 20000000) - (agentData?.portfolio_value || 0)) / 1000000 > 0 
                    ? `${(((agentData?.portfolio_limit || 20000000) - (agentData?.portfolio_value || 0)) / 1000000).toFixed(1)}M to go! 🚀`
                    : 'Limit reached! 🎉'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Motorcycle Countdown Banner */}
        {tenantsToMotorcycle > 0 && (
          <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-xl transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="text-4xl">🏍️</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">Bike Reward</h3>
                  <p className="text-base">
                    <span className="text-3xl font-black">{tenantsToMotorcycle}</span> more to go!
                  </p>
                  <Progress value={((agentData?.active_tenants || 0) / 50) * 100} className="mt-2 h-2 bg-white/30" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Payment Method Breakdown Chart */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">💳 Payment Types</CardTitle>
            <CardDescription className="text-xs">
              Last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Chart */}
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={paymentMethodBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis 
                    dataKey="method" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${(parseFloat(value) / 1000).toFixed(0)}K`, 'Amount']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {paymentMethodBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Trend Indicators */}
              <div className="grid grid-cols-3 gap-2">
                {paymentMethodBreakdown.map((item) => (
                  <div key={item.method} className="text-center p-3 rounded-xl border hover:shadow-md transition-shadow" style={{ borderColor: item.color, backgroundColor: `${item.color}15` }}>
                    <div className="text-lg font-bold" style={{ color: item.color }}>
                      {(item.amount / 1000).toFixed(0)}K
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.method}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-1.5">
                      {item.trendIcon === 'up' && (
                        <>
                          <ArrowUp className="h-3 w-3 text-success" />
                          <span className="text-xs font-semibold text-success">+{item.trend.toFixed(0)}%</span>
                        </>
                      )}
                      {item.trendIcon === 'down' && (
                        <>
                          <ArrowDown className="h-3 w-3 text-destructive" />
                          <span className="text-xs font-semibold text-destructive">{item.trend.toFixed(0)}%</span>
                        </>
                      )}
                      {item.trendIcon === 'neutral' && (
                        <>
                          <Minus className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground">0%</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Verification Stats */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">✅ Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-orange-500">{pendingVerifications}</div>
                <p className="text-xs text-muted-foreground mt-1">⏳ Pending</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-success/10 border border-success/20 hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-success">{verifiedPayments}</div>
                <p className="text-xs text-muted-foreground mt-1">✓ Verified</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-destructive/10 border border-destructive/20 hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-destructive">{rejectedPayments}</div>
                <p className="text-xs text-muted-foreground mt-1">✗ Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collection Rate */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">📈 Collection Rate</CardTitle>
            <CardDescription className="text-xs">
              Keep above 95% to maintain limit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-xs text-muted-foreground">Current</span>
                <span className="text-3xl font-bold">{agentData?.collection_rate || 0}%</span>
              </div>
              <Progress value={agentData?.collection_rate || 0} className="h-2.5" />
              {(agentData?.collection_rate || 0) < 95 && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-xl mt-3">
                  <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning-foreground">
                    Below 95% - collect payments to keep limit! 💪
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
        </ContentTransition>
      </PullToRefresh>
    </AgentLayout>
  );
};

export default AgentDashboard;

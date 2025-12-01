import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import { useSwipeable } from "react-swipeable";
import AgentLayout from "@/components/AgentLayout";
import { DashboardSkeleton } from "@/components/TenantDetailSkeleton";
import { ContentTransition, SlideUpTransition } from "@/components/ContentTransition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Bike, TrendingUp, Users, DollarSign, AlertCircle, Plus, Zap, ArrowUp, ArrowDown, Minus, Bell, MessageSquare, X, Reply, Send, MessageCircle, Calculator, Wallet, UserPlus, UserCheck, ArrowDownToLine, ArrowRightLeft } from "lucide-react";
import { TenantSearchWidget } from "@/components/TenantSearchWidget";
import MessageThreadDialog from "@/components/MessageThreadDialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import QuickPaymentDialog from "@/components/QuickPaymentDialog";
import { DailyRepaymentCalculatorDialog } from "@/components/DailyRepaymentCalculatorDialog";
import { CommissionCalculatorDialog } from "@/components/CommissionCalculatorDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { TransferMoneyDialog } from "@/components/TransferMoneyDialog";
import { clearOldCaches, getCacheSize } from "@/lib/cacheManager";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { BackgroundSyncIndicator } from "@/components/BackgroundSyncIndicator";

const AgentDashboard = () => {
  const navigate = useNavigate();
  const { user, agentId, isLoading: authLoading } = useAuth();
  const [agentData, setAgentData] = useState<any>(null);
  const [activeTenantCount, setActiveTenantCount] = useState(0);
  const [pipelineTenantCount, setPipelineTenantCount] = useState(0);
  const [todaysCollections, setTodaysCollections] = useState(0);
  const [todaysTarget, setTodaysTarget] = useState(0);
  const [tenantsDueToday, setTenantsDueToday] = useState(0);
  const [overdueTenants, setOverdueTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [commissionCalculatorOpen, setCommissionCalculatorOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [verifiedPayments, setVerifiedPayments] = useState(0);
  const [rejectedPayments, setRejectedPayments] = useState(0);
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<any[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [thisMonthCommission, setThisMonthCommission] = useState(0);
  const [commissionTrend, setCommissionTrend] = useState<any[]>([]);
  const [managerNotifications, setManagerNotifications] = useState<any[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const [previousNotificationCount, setPreviousNotificationCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState(false);
  const [threadViewOpen, setThreadViewOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [threadCounts, setThreadCounts] = useState<{ [key: string]: number }>({});
  
  // Ref for auto-scroll to manager messages
  const managerMessagesRef = useRef<HTMLDivElement>(null);
  
  // Service worker for caching
  useServiceWorker();

  useEffect(() => {
    if (agentId) {
      fetchAgentData();
      fetchManagerNotifications();
    }
  }, [agentId]);

  useEffect(() => {
    if (!user || !agentId) return;
    
    // Initialize cache management once
    const initCache = async () => {
      await clearOldCaches();
      
      // Log cache size for monitoring
      const cacheSize = await getCacheSize();
      if (cacheSize) {
        console.log(`Cache usage: ${(cacheSize.usage / 1024 / 1024).toFixed(2)}MB / ${(cacheSize.quota / 1024 / 1024).toFixed(2)}MB (${cacheSize.percentage.toFixed(1)}%)`);
      }
    };
    
    initCache();

    // Set up realtime subscription for notifications AND agent wallet updates
    const channel = supabase
      .channel("dashboard-updates")
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
          filter: `id=eq.${agentId}`,
        },
        (payload) => {
          // Update wallet balance in real-time
          if (payload.new && payload.new.wallet_balance !== payload.old?.wallet_balance) {
            setAgentData((prev: any) => ({
              ...prev,
              wallet_balance: payload.new.wallet_balance
            }));
            
            // Show toast notification for wallet changes
            const change = (payload.new.wallet_balance || 0) - (payload.old?.wallet_balance || 0);
            if (change > 0) {
              haptics.success();
              toast.success(`💰 Wallet Updated! +UGX ${change.toLocaleString()}`, {
                duration: 4000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel).catch(console.error);
      });
    };
  }, [user, agentId]);

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
      if (!agentId) return;
      
      setIsLoading(true);

      const { data: agent, error } = await supabase
        .from("agents")
        .select("*, wallet_balance")
        .eq("id", agentId)
        .single();

      if (error) {
        console.error("Error fetching agent data:", error);
        toast.error("Failed to load dashboard data");
        return;
      }

      setAgentData(agent);

      const today = new Date().toISOString().split('T')[0];

      // Batch all queries in parallel for faster loading
      const [
        collectionsResult,
        dueTenantsResult,
        overdueResult,
        pendingResult,
        verifiedResult,
        rejectedResult,
        paymentMethodResult,
        commissionResult,
        thisMonthCommissionResult,
        allTenantsResult
      ] = await Promise.all([
        supabase
          .from("collections")
          .select("amount")
          .eq("agent_id", agentId)
          .eq("collection_date", today),
        
        supabase
          .from("tenants")
          .select("rent_amount")
          .eq("agent_id", agentId)
          .eq("next_payment_date", today)
          .eq("status", "verified"),
        
        supabase
          .from("tenants")
          .select("id, tenant_name, next_payment_date, outstanding_balance")
          .eq("agent_id", agentId)
          .lt("next_payment_date", today)
          .in("status", ["verified", "active"])
          .order("next_payment_date", { ascending: true }),
        
        supabase
          .from("collections")
          .select("id")
          .eq("agent_id", agentId)
          .eq("status", "pending"),
        
        supabase
          .from("collections")
          .select("id")
          .eq("agent_id", agentId)
          .eq("status", "verified"),
        
        supabase
          .from("collections")
          .select("id")
          .eq("agent_id", agentId)
          .eq("status", "rejected"),
        
        supabase
          .from("collections")
          .select("amount, payment_method")
          .eq("agent_id", agentId)
          .gte("collection_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        
        supabase
          .from("collections")
          .select("commission")
          .eq("agent_id", agentId)
          .eq("status", "verified"),
        
        supabase
          .from("collections")
          .select("commission")
          .eq("agent_id", agentId)
          .eq("status", "verified")
          .gte("collection_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
        
        supabase
          .from("tenants")
          .select("outstanding_balance")
          .eq("agent_id", agentId)
      ]);

      // Process results
      const total = collectionsResult.data?.reduce((sum, col) => sum + parseFloat(col.amount.toString()), 0) || 0;
      setTodaysCollections(total);

      const dueCount = dueTenantsResult.data?.length || 0;
      const target = dueTenantsResult.data?.reduce((sum, tenant) => sum + parseFloat(tenant.rent_amount?.toString() || '0'), 0) || 0;
      setTenantsDueToday(dueCount);
      setTodaysTarget(target);

      if (overdueResult.data) {
        const overdueWithDays = overdueResult.data.map(tenant => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - new Date(tenant.next_payment_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          return { ...tenant, daysOverdue };
        });
        setOverdueTenants(overdueWithDays);
      }

      setPendingVerifications(pendingResult.data?.length || 0);
      setVerifiedPayments(verifiedResult.data?.length || 0);
      setRejectedPayments(rejectedResult.data?.length || 0);

      // Calculate active vs pipeline tenants
      if (allTenantsResult.data) {
        const active = allTenantsResult.data.filter(t => parseFloat(t.outstanding_balance?.toString() || '0') > 0).length;
        const pipeline = allTenantsResult.data.filter(t => parseFloat(t.outstanding_balance?.toString() || '0') === 0).length;
        setActiveTenantCount(active);
        setPipelineTenantCount(pipeline);
      }

      // Process payment method breakdown
      if (paymentMethodResult.data) {
        const methodTotals = paymentMethodResult.data.reduce((acc: any, col: any) => {
          const method = col.payment_method || 'unknown';
          acc[method] = (acc[method] || 0) + parseFloat(col.amount?.toString() || '0');
          return acc;
        }, {});

        const breakdownData = Object.entries(methodTotals).map(([method, amount]) => ({
          method: method.charAt(0).toUpperCase() + method.slice(1),
          amount: amount as number
        }));

        setPaymentMethodBreakdown(breakdownData);
      }

      // Process commission data
      const totalComm = commissionResult.data?.reduce((sum, col) => sum + parseFloat(col.commission?.toString() || '0'), 0) || 0;
      setTotalCommission(totalComm);

      const monthComm = thisMonthCommissionResult.data?.reduce((sum, col) => sum + parseFloat(col.commission?.toString() || '0'), 0) || 0;
      setThisMonthCommission(monthComm);

      // Fetch commission trend for last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: trendData } = await supabase
        .from("collections")
        .select("collection_date, commission")
        .eq("agent_id", agentId)
        .eq("status", "verified")
        .gte("collection_date", sevenDaysAgo)
        .order("collection_date", { ascending: true });

      if (trendData) {
        // Group by date and sum commissions
        const dailyCommission = trendData.reduce((acc: any, col: any) => {
          const date = col.collection_date;
          acc[date] = (acc[date] || 0) + parseFloat(col.commission?.toString() || '0');
          return acc;
        }, {});

        // Create array with all 7 days (including days with 0 commission)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          const dayName = format(date, 'EEE');
          last7Days.push({
            date: dayName,
            commission: dailyCommission[dateStr] || 0,
            fullDate: dateStr
          });
        }

        setCommissionTrend(last7Days);
      }
    } catch (error) {
      console.error("Error in fetchAgentData:", error);
      toast.error("Failed to load dashboard");
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
        .is("parent_notification_id", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const filteredData = (data || []).filter(n => !dismissedNotifications.includes(n.id));
      
      // Batch fetch reply counts in parallel
      const countsPromises = filteredData.map(notification =>
        supabase
          .from("notifications")
          .select("*", { count: 'exact', head: true })
          .eq("parent_notification_id", notification.id)
          .then(({ count }) => ({ id: notification.id, count: count || 0 }))
      );
      
      const countsResults = await Promise.all(countsPromises);
      const counts: { [key: string]: number } = {};
      countsResults.forEach(result => {
        counts[result.id] = result.count;
      });
      setThreadCounts(counts);
      
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

  const handleSendReply = async (notificationId: string, originalSenderId: string, originalTitle: string) => {
    if (!replyText.trim()) {
      toast.error("Reply cannot be empty");
      return;
    }

    try {
      setSendingReply(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Send reply as a new notification to the manager
      const { error } = await supabase
        .from("notifications")
        .insert({
          sender_id: user.id,
          recipient_id: originalSenderId,
          title: `Re: ${originalTitle}`,
          message: replyText,
          priority: "normal",
          read: false,
          parent_notification_id: notificationId
        });

      if (error) throw error;

      haptics.success();
      toast.success("Reply sent to manager!");
      setReplyText("");
      setReplyingTo(null);

      // Mark original notification as read
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const portfolioPercentage = agentData ? (agentData.portfolio_value / agentData.portfolio_limit) * 100 : 0;
  const tenantsToMotorcycle = Math.max(0, 50 - (agentData?.active_tenants || 0));

  // Swipe handlers for commission card
  const commissionSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      haptics.light();
      navigate("/agent/earnings");
    },
    onSwipedRight: () => {
      haptics.light();
      navigate("/agent/earnings");
    },
    trackMouse: true,
    trackTouch: true,
  });

  if (isLoading || authLoading) {
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

          {/* Commission Hero Card - PRIORITY DISPLAY */}
          <div {...commissionSwipeHandlers} className="cursor-pointer active:scale-98 transition-transform">
            <Card className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white overflow-hidden relative hover:shadow-2xl transition-all border-4 border-emerald-400/50">
              <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/10 rounded-full translate-y-28 -translate-x-28" />
              
              {/* Swipe Hint Indicator */}
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1 animate-pulse">
                <span className="text-xs font-medium">👈 Swipe</span>
              </div>
              
              <CardContent className="p-8 relative z-10">
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/25 backdrop-blur-sm rounded-2xl">
                    <DollarSign className="h-10 w-10" />
                  </div>
                  <div>
                    <p className="text-sm font-medium opacity-95 mb-1">💰 Total Commission Earned</p>
                    <h2 className="text-5xl font-black tracking-tight">
                      {(totalCommission / 1000).toFixed(0)}K
                    </h2>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
                    <p className="text-xs opacity-90 mb-1">This Month</p>
                    <p className="text-2xl font-bold">
                      {(thisMonthCommission / 1000).toFixed(0)}K
                    </p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
                    <p className="text-xs opacity-90 mb-1">All Time</p>
                    <p className="text-2xl font-bold">
                      UGX {totalCommission.toLocaleString()}
                    </p>
                  </div>
                </div>

                <Button 
                  variant="secondary"
                  className="w-full font-bold text-base py-6 bg-white text-emerald-600 hover:bg-white/90"
                  onClick={() => navigate("/agent/earnings")}
                >
                  View Full Earnings →
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Wallet Balance Card - NEW FEATURE */}
          <Card className="bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-500 text-white overflow-hidden relative hover:shadow-2xl transition-all border-4 border-purple-400/50">
            <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full translate-y-16 -translate-x-16" />
            
            <CardContent className="p-8 relative z-10">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/25 backdrop-blur-sm rounded-2xl">
                      <Wallet className="h-10 w-10" />
                    </div>
                    <div>
                      <p className="text-sm font-medium opacity-95 mb-1">💼 Live Wallet Balance</p>
                      <h2 className="text-5xl font-black tracking-tight">
                        {((agentData?.wallet_balance || 0) / 1000).toFixed(1)}K
                      </h2>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
                  <p className="text-xs opacity-90 mb-1">Available for Withdrawal</p>
                  <p className="text-3xl font-bold">
                    UGX {(agentData?.wallet_balance || 0).toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="secondary"
                    className="font-bold text-base py-6 bg-white text-purple-600 hover:bg-white/90 flex flex-col items-center gap-1"
                    onClick={() => navigate("/agent/register-landlord")}
                  >
                    <UserPlus className="h-5 w-5" />
                    <span>+ Landlord</span>
                    <span className="text-xs">+UGX 500</span>
                  </Button>
                  <Button 
                    variant="secondary"
                    className="font-bold text-base py-6 bg-white text-purple-600 hover:bg-white/90 flex flex-col items-center gap-1"
                    onClick={() => navigate("/agent/register-tenant")}
                  >
                    <Plus className="h-5 w-5" />
                    <span>+ Tenant</span>
                    <span className="text-xs">+UGX 5,000</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button 
                    variant="secondary"
                    className="font-bold text-sm py-5 bg-green-600 text-white hover:bg-green-700 flex flex-col items-center gap-1"
                    onClick={() => {
                      setWithdrawDialogOpen(true);
                      haptics.light();
                    }}
                  >
                    <ArrowDownToLine className="h-5 w-5" />
                    <span>Withdraw</span>
                  </Button>
                  <Button 
                    variant="secondary"
                    className="font-bold text-sm py-5 bg-blue-600 text-white hover:bg-blue-700 flex flex-col items-center gap-1"
                    onClick={() => {
                      setTransferDialogOpen(true);
                      haptics.light();
                    }}
                  >
                    <ArrowRightLeft className="h-5 w-5" />
                    <span>Transfer</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tenant Search Widget */}
          {agentId && <TenantSearchWidget agentId={agentId} />}

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
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

            <Button 
              size="lg" 
              className="h-24 text-base font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                setCalculatorOpen(true);
                haptics.light();
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <Calculator className="h-8 w-8" />
                <span className="text-xs">Calculator</span>
              </div>
            </Button>
          </div>

          {/* Secondary Actions Row */}
          <div className="grid grid-cols-2 gap-4">
            <Button 
              size="lg" 
              variant="outline"
              className="h-20 text-sm font-semibold shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              onClick={() => {
                setCommissionCalculatorOpen(true);
                haptics.light();
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <DollarSign className="h-6 w-6" />
                <span className="text-xs">Commission Calculator</span>
              </div>
            </Button>

            <Button 
              size="lg" 
              variant="outline"
              className="h-20 text-sm font-semibold shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 border-2"
              onClick={() => navigate("/agent/earnings")}
            >
              <div className="flex flex-col items-center gap-1">
                <TrendingUp className="h-6 w-6" />
                <span className="text-xs">View Earnings</span>
              </div>
            </Button>
          </div>

          <QuickPaymentDialog
            open={quickPaymentOpen}
            onOpenChange={setQuickPaymentOpen}
            onSuccess={fetchAgentData}
          />

          <DailyRepaymentCalculatorDialog
            open={calculatorOpen}
            onOpenChange={setCalculatorOpen}
          />

          <CommissionCalculatorDialog
            open={commissionCalculatorOpen}
            onOpenChange={setCommissionCalculatorOpen}
          />

          <WithdrawDialog
            open={withdrawDialogOpen}
            onOpenChange={setWithdrawDialogOpen}
            agentId={agentId || ""}
            currentBalance={agentData?.wallet_balance || 0}
            onSuccess={fetchAgentData}
          />

          <TransferMoneyDialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            agentId={agentId || ""}
            currentBalance={agentData?.wallet_balance || 0}
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

          <Card 
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
            onClick={() => {
              haptics.light();
              navigate("/agent/tenants?tab=active");
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                💰 Active Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{activeTenantCount}</div>
              <p className="text-xs text-success mt-1">With outstanding balances</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
            onClick={() => {
              haptics.light();
              navigate("/agent/tenants?tab=pipeline");
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-500" />
                📋 Pipeline Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{pipelineTenantCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered, no balance</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
            onClick={() => {
              haptics.light();
              navigate("/agent/tenants?tab=overdue");
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                ⚠️ Overdue Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{overdueTenants.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Need immediate attention</p>
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

        {/* Commission Growth Trend Chart */}
        <Card className="hover:shadow-lg transition-shadow border-2 border-emerald-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              💰 Commission Trend
            </CardTitle>
            <CardDescription className="text-xs">
              Last 7 days earnings momentum
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={commissionTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip 
                  formatter={(value: any) => [`UGX ${parseFloat(value).toLocaleString()}`, 'Commission']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="commission" fill="hsl(142 76% 36%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-lg font-bold text-emerald-600">
                  {commissionTrend.length > 0 ? (commissionTrend[commissionTrend.length - 1].commission / 1000).toFixed(0) : 0}K
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Today</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-lg font-bold text-emerald-600">
                  {commissionTrend.reduce((sum, day) => sum + day.commission, 0) / 1000 > 0 
                    ? (commissionTrend.reduce((sum, day) => sum + day.commission, 0) / 1000).toFixed(0) 
                    : 0}K
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">7-Day Total</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-lg font-bold text-emerald-600">
                  {commissionTrend.length > 0 
                    ? (commissionTrend.reduce((sum, day) => sum + day.commission, 0) / commissionTrend.filter(d => d.commission > 0).length / 1000 || 0).toFixed(0)
                    : 0}K
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Daily Avg</p>
              </div>
            </div>
          </CardContent>
        </Card>

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

      {quickPaymentOpen && (
        <QuickPaymentDialog
          open={quickPaymentOpen}
          onOpenChange={setQuickPaymentOpen}
        />
      )}

      <MessageThreadDialog
        open={threadViewOpen}
        onOpenChange={setThreadViewOpen}
        notificationId={selectedThreadId}
        onReplySent={() => {
          fetchManagerNotifications();
          fetchAgentData();
        }}
      />
      
      <BackgroundSyncIndicator />
    </AgentLayout>
  );
};

export default AgentDashboard;

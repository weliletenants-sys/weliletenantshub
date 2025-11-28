import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import ManagerLayout from "@/components/ManagerLayout";
import { ManagerDashboardSkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, AlertCircle, TrendingUp, Shield, Search, CheckCircle2, XCircle, Clock, Wallet, ArrowUp, ArrowDown, Award, Target, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { useRealtimeAllTenants, useRealtimeAllCollections, useRealtimeAgents, registerSyncCallback } from "@/hooks/useRealtimeSubscription";
import { useRealtimeSyncStatus } from "@/hooks/useRealtimeSyncStatus";
import { DataSyncBadge } from "@/components/RealtimeSyncIndicator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalTenants: 0,
    pendingVerifications: 0,
    pendingPayments: 0,
    verifiedPayments: 0,
    rejectedPayments: 0,
    totalPortfolioValue: 0,
    portfolioDayChange: 0,
    portfolioDayChangePercent: 0,
    portfolioWeekChange: 0,
    portfolioWeekChangePercent: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showTenantSearch, setShowTenantSearch] = useState(false);
  const [showAgentSearch, setShowAgentSearch] = useState(false);
  const [tenantSearchQuery, setTenantSearchQuery] = useState("");
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Tenant filters
  const [tenantStatusFilter, setTenantStatusFilter] = useState<string>("all");
  const [minBalanceFilter, setMinBalanceFilter] = useState<string>("");
  const [maxBalanceFilter, setMaxBalanceFilter] = useState<string>("");
  const [startDateFilter, setStartDateFilter] = useState<Date | undefined>();
  const [endDateFilter, setEndDateFilter] = useState<Date | undefined>();
  
  // Agent filters
  const [agentStatusFilter, setAgentStatusFilter] = useState<string>("all");
  const [minTenantsFilter, setMinTenantsFilter] = useState<string>("");
  const [maxTenantsFilter, setMaxTenantsFilter] = useState<string>("");
  const [agentGrowthComparison, setAgentGrowthComparison] = useState<any[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<any[]>([]);
  const [agentPaymentMethodData, setAgentPaymentMethodData] = useState<any[]>([]);

  // Track previous values for change detection
  const [prevPortfolioValue, setPrevPortfolioValue] = useState<number | null>(null);
  const [prevTotalTenants, setPrevTotalTenants] = useState<number | null>(null);
  const [prevPendingVerifications, setPrevPendingVerifications] = useState<number | null>(null);
  const [prevPendingPayments, setPrevPendingPayments] = useState<number | null>(null);

  // Subscribe to real-time updates for all agent activity
  useRealtimeAllTenants();
  useRealtimeAllCollections();
  useRealtimeAgents();

  // Track sync status for tenants table (for portfolio value updates)
  const { lastSyncTime } = useRealtimeSyncStatus('tenants');

  // Show toast notification when portfolio value changes
  useEffect(() => {
    if (prevPortfolioValue !== null && stats.totalPortfolioValue !== prevPortfolioValue) {
      const difference = stats.totalPortfolioValue - prevPortfolioValue;
      const isIncrease = difference > 0;
      
      toast.success(
        `Portfolio ${isIncrease ? 'Increased' : 'Decreased'}`,
        {
          description: `${isIncrease ? '+' : ''}UGX ${Math.abs(difference).toLocaleString()}`,
          duration: 4000,
        }
      );
      haptics.success();
    }
    
    setPrevPortfolioValue(stats.totalPortfolioValue);
  }, [stats.totalPortfolioValue]);

  // Show toast notification when total tenants changes
  useEffect(() => {
    if (prevTotalTenants !== null && stats.totalTenants !== prevTotalTenants) {
      const difference = stats.totalTenants - prevTotalTenants;
      const isIncrease = difference > 0;
      
      if (isIncrease) {
        toast.success(
          `New Tenant${difference > 1 ? 's' : ''} Added`,
          {
            description: `${difference} new tenant${difference > 1 ? 's' : ''} registered`,
            duration: 4000,
          }
        );
        haptics.success();
      }
    }
    
    setPrevTotalTenants(stats.totalTenants);
  }, [stats.totalTenants]);

  // Show toast notification when pending verifications change
  useEffect(() => {
    if (prevPendingVerifications !== null && stats.pendingVerifications !== prevPendingVerifications) {
      const difference = stats.pendingVerifications - prevPendingVerifications;
      const isIncrease = difference > 0;
      
      if (isIncrease) {
        toast.info(
          `New Verification${Math.abs(difference) > 1 ? 's' : ''} Pending`,
          {
            description: `${Math.abs(difference)} tenant${Math.abs(difference) > 1 ? 's' : ''} awaiting verification`,
            duration: 4000,
          }
        );
        haptics.light();
      }
    }
    
    setPrevPendingVerifications(stats.pendingVerifications);
  }, [stats.pendingVerifications]);

  // Show toast notification when pending payments change
  useEffect(() => {
    if (prevPendingPayments !== null && stats.pendingPayments !== prevPendingPayments) {
      const difference = stats.pendingPayments - prevPendingPayments;
      const isIncrease = difference > 0;
      
      if (isIncrease) {
        toast.info(
          `New Payment${Math.abs(difference) > 1 ? 's' : ''} to Review`,
          {
            description: `${Math.abs(difference)} payment${Math.abs(difference) > 1 ? 's' : ''} awaiting verification`,
            duration: 4000,
          }
        );
        haptics.light();
      }
    }
    
    setPrevPendingPayments(stats.pendingPayments);
  }, [stats.pendingPayments]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const [agentsResult, tenantsResult] = await Promise.all([
          supabase.from("agents").select("*"),
          supabase.from("tenants").select("*"),
        ]);

        if (agentsResult.error) {
          console.error("Error fetching agents:", agentsResult.error);
        }
        
        if (tenantsResult.error) {
          console.error("Error fetching tenants:", tenantsResult.error);
        }

        const totalAgents = agentsResult.data?.length || 0;
        const totalTenants = tenantsResult.data?.length || 0;
        const pendingVerifications = tenantsResult.data?.filter(t => t.status === 'pending').length || 0;

        // Calculate total portfolio value from outstanding balances
        const totalPortfolioValue = tenantsResult.data?.reduce((sum, tenant) => {
          return sum + (parseFloat(tenant.outstanding_balance?.toString() || '0'));
        }, 0) || 0;

        // Calculate portfolio growth (day-over-day and week-over-week)
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        // Fetch collections from yesterday to calculate day change
        const { data: yesterdayCollections } = await supabase
          .from("collections")
          .select("amount")
          .eq("status", "verified")
          .gte("collection_date", yesterday.toISOString().split('T')[0])
          .lt("collection_date", today.toISOString().split('T')[0]);

        const yesterdayTotal = yesterdayCollections?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

        // Fetch collections from last 7 days for week change
        const { data: weekCollections } = await supabase
          .from("collections")
          .select("amount, collection_date")
          .eq("status", "verified")
          .gte("collection_date", lastWeek.toISOString().split('T')[0]);

        const thisWeekTotal = weekCollections?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;
        
        // Calculate changes
        const portfolioDayChange = yesterdayTotal;
        const portfolioDayChangePercent = totalPortfolioValue > 0 ? (portfolioDayChange / totalPortfolioValue) * 100 : 0;
        
        const portfolioWeekChange = thisWeekTotal;
        const portfolioWeekChangePercent = totalPortfolioValue > 0 ? (portfolioWeekChange / totalPortfolioValue) * 100 : 0;

        // Fetch payment verification stats
        const { data: collectionsData } = await supabase
          .from("collections")
          .select("status");

        const pendingPayments = collectionsData?.filter(c => c.status === 'pending').length || 0;
        const verifiedPayments = collectionsData?.filter(c => c.status === 'verified').length || 0;
        const rejectedPayments = collectionsData?.filter(c => c.status === 'rejected').length || 0;

        setStats({
          totalAgents,
          activeAgents: totalAgents,
          totalTenants,
          pendingVerifications,
          pendingPayments,
          verifiedPayments,
          rejectedPayments,
          totalPortfolioValue,
          portfolioDayChange,
          portfolioDayChangePercent,
          portfolioWeekChange,
          portfolioWeekChangePercent,
        });

        // Calculate agent growth comparison
        await calculateAgentGrowthComparison(agentsResult.data || []);
        
        // Fetch payment method breakdown
        await fetchPaymentMethodBreakdown();
        
        // Fetch agent payment method breakdown
        await fetchAgentPaymentMethodBreakdown(agentsResult.data || []);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();

    // Listen for real-time sync events and refetch stats
    const unregisterCallback = registerSyncCallback((table) => {
      console.log(`Real-time update detected on ${table}, refreshing dashboard stats`);
      fetchStats();
    });

    return () => {
      unregisterCallback();
    };
  }, []);

  const handleRefresh = async () => {
    haptics.refresh();
    const [agentsResult, tenantsResult] = await Promise.all([
      supabase.from("agents").select("*"),
      supabase.from("tenants").select("*"),
    ]);

    const totalAgents = agentsResult.data?.length || 0;
    const totalTenants = tenantsResult.data?.length || 0;
    const pendingVerifications = tenantsResult.data?.filter(t => t.status === 'pending').length || 0;

    // Calculate total portfolio value from outstanding balances
    const totalPortfolioValue = tenantsResult.data?.reduce((sum, tenant) => {
      return sum + (parseFloat(tenant.outstanding_balance?.toString() || '0'));
    }, 0) || 0;

    // Calculate portfolio growth
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const { data: yesterdayCollections } = await supabase
      .from("collections")
      .select("amount")
      .eq("status", "verified")
      .gte("collection_date", yesterday.toISOString().split('T')[0])
      .lt("collection_date", today.toISOString().split('T')[0]);

    const yesterdayTotal = yesterdayCollections?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

    const { data: weekCollections } = await supabase
      .from("collections")
      .select("amount")
      .eq("status", "verified")
      .gte("collection_date", lastWeek.toISOString().split('T')[0]);

    const thisWeekTotal = weekCollections?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;
    
    const portfolioDayChange = yesterdayTotal;
    const portfolioDayChangePercent = totalPortfolioValue > 0 ? (portfolioDayChange / totalPortfolioValue) * 100 : 0;
    const portfolioWeekChange = thisWeekTotal;
    const portfolioWeekChangePercent = totalPortfolioValue > 0 ? (portfolioWeekChange / totalPortfolioValue) * 100 : 0;

    // Fetch payment verification stats
    const { data: collectionsData } = await supabase
      .from("collections")
      .select("status");

    const pendingPayments = collectionsData?.filter(c => c.status === 'pending').length || 0;
    const verifiedPayments = collectionsData?.filter(c => c.status === 'verified').length || 0;
    const rejectedPayments = collectionsData?.filter(c => c.status === 'rejected').length || 0;

    setStats({
      totalAgents,
      activeAgents: totalAgents,
      totalTenants,
      pendingVerifications,
      pendingPayments,
      verifiedPayments,
      rejectedPayments,
      totalPortfolioValue,
      portfolioDayChange,
      portfolioDayChangePercent,
      portfolioWeekChange,
      portfolioWeekChangePercent,
    });
    
    await calculateAgentGrowthComparison(agentsResult.data || []);
    await fetchPaymentMethodBreakdown();
    await fetchAgentPaymentMethodBreakdown(agentsResult.data || []);
    
    toast.success("Dashboard refreshed");
  };

  const fetchPaymentMethodBreakdown = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Fetch current period (last 30 days)
      const { data: currentPeriod } = await supabase
        .from("collections")
        .select("amount, payment_method")
        .eq("status", "verified")
        .gte("collection_date", thirtyDaysAgo.toISOString().split('T')[0]);

      // Fetch previous period (30-60 days ago)
      const { data: previousPeriod } = await supabase
        .from("collections")
        .select("amount, payment_method")
        .eq("status", "verified")
        .gte("collection_date", sixtyDaysAgo.toISOString().split('T')[0])
        .lt("collection_date", thirtyDaysAgo.toISOString().split('T')[0]);

      // Calculate totals by method
      const calculateTotals = (data: any[]) => {
        return {
          cash: data?.filter(c => c.payment_method === "cash").reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0,
          mtn: data?.filter(c => c.payment_method === "mtn").reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0,
          airtel: data?.filter(c => c.payment_method === "airtel").reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0,
        };
      };

      const current = calculateTotals(currentPeriod || []);
      const previous = calculateTotals(previousPeriod || []);

      // Calculate trends
      const calculateTrend = (currentVal: number, previousVal: number) => {
        if (previousVal === 0) return currentVal > 0 ? 100 : 0;
        return ((currentVal - previousVal) / previousVal) * 100;
      };

      const chartData = [
        {
          method: "Cash",
          amount: current.cash,
          trend: calculateTrend(current.cash, previous.cash),
        },
        {
          method: "MTN Mobile Money",
          amount: current.mtn,
          trend: calculateTrend(current.mtn, previous.mtn),
        },
        {
          method: "Airtel Money",
          amount: current.airtel,
          trend: calculateTrend(current.airtel, previous.airtel),
        },
      ];

      setPaymentMethodData(chartData);
    } catch (error) {
      console.error("Error fetching payment method breakdown:", error);
    }
  };

  const fetchAgentPaymentMethodBreakdown = async (agents: any[]) => {
    if (!agents || agents.length === 0) {
      setAgentPaymentMethodData([]);
      return;
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch collections for all agents
      const { data: collections } = await supabase
        .from("collections")
        .select("agent_id, amount, payment_method")
        .eq("status", "verified")
        .gte("collection_date", thirtyDaysAgo.toISOString().split('T')[0]);

      // Calculate payment method breakdown per agent
      const agentBreakdown = await Promise.all(
        agents.slice(0, 10).map(async (agent) => {
          // Get agent profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", agent.user_id)
            .single();

          const agentCollections = collections?.filter(c => c.agent_id === agent.id) || [];

          const cashTotal = agentCollections
            .filter(c => c.payment_method === "cash")
            .reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0);

          const mtnTotal = agentCollections
            .filter(c => c.payment_method === "mtn")
            .reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0);

          const airtelTotal = agentCollections
            .filter(c => c.payment_method === "airtel")
            .reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0);

          const totalCollections = cashTotal + mtnTotal + airtelTotal;

          return {
            id: agent.id,
            name: profile?.full_name || 'Unknown Agent',
            cash: cashTotal,
            mtn: mtnTotal,
            airtel: airtelTotal,
            total: totalCollections,
            cashPercent: totalCollections > 0 ? (cashTotal / totalCollections) * 100 : 0,
            mtnPercent: totalCollections > 0 ? (mtnTotal / totalCollections) * 100 : 0,
            airtelPercent: totalCollections > 0 ? (airtelTotal / totalCollections) * 100 : 0,
          };
        })
      );

      // Sort by total collections (highest first)
      agentBreakdown.sort((a, b) => b.total - a.total);

      setAgentPaymentMethodData(agentBreakdown.filter(a => a.total > 0));
    } catch (error) {
      console.error("Error fetching agent payment method breakdown:", error);
    }
  };

  const handleTenantSearch = async () => {
    if (!tenantSearchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    try {
      let query = supabase
        .from("tenants")
        .select(`
          *,
          agents (
            profiles:user_id (
              full_name,
              phone_number
            )
          )
        `)
        .or(`tenant_name.ilike.%${tenantSearchQuery}%,tenant_phone.ilike.%${tenantSearchQuery}%`);

      // Apply status filter
      if (tenantStatusFilter !== "all") {
        query = query.eq("status", tenantStatusFilter);
      }

      // Apply balance range filter
      if (minBalanceFilter) {
        query = query.gte("outstanding_balance", parseFloat(minBalanceFilter));
      }
      if (maxBalanceFilter) {
        query = query.lte("outstanding_balance", parseFloat(maxBalanceFilter));
      }

      // Apply date range filter
      if (startDateFilter) {
        query = query.gte("created_at", format(startDateFilter, "yyyy-MM-dd"));
      }
      if (endDateFilter) {
        query = query.lte("created_at", format(endDateFilter, "yyyy-MM-dd"));
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;

      setSearchResults(data || []);
      
      if (!data || data.length === 0) {
        toast.info("No tenants found matching your search");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search tenants");
    }
  };

  const handleAgentSearch = async () => {
    if (!agentSearchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    try {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number")
        .eq("role", "agent")
        .or(`full_name.ilike.%${agentSearchQuery}%,phone_number.ilike.%${agentSearchQuery}%`)
        .limit(50);

      if (profileError) throw profileError;

      const userIds = profiles?.map(p => p.id) || [];

      if (userIds.length === 0) {
        setSearchResults([]);
        toast.info("No agents found matching your search");
        return;
      }

      let query = supabase
        .from("agents")
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number
          )
        `)
        .in("user_id", userIds);

      const { data: agentsData, error } = await query;

      if (error) throw error;

      // Fetch tenant counts for filtering
      if (agentsData && agentsData.length > 0) {
        const agentIds = agentsData.map(a => a.id);
        const { data: tenantCounts } = await supabase
          .from("tenants")
          .select("agent_id")
          .in("agent_id", agentIds);

        const tenantCountMap = (tenantCounts || []).reduce((acc: Record<string, number>, tenant) => {
          acc[tenant.agent_id] = (acc[tenant.agent_id] || 0) + 1;
          return acc;
        }, {});

        let filteredAgents = agentsData.map(agent => ({
          ...agent,
          tenant_count: tenantCountMap[agent.id] || 0,
        }));

        // Apply status filter (active/inactive based on tenant count)
        if (agentStatusFilter === "active") {
          filteredAgents = filteredAgents.filter(a => a.tenant_count > 0);
        } else if (agentStatusFilter === "inactive") {
          filteredAgents = filteredAgents.filter(a => a.tenant_count === 0);
        }

        // Apply tenant count range filter
        if (minTenantsFilter) {
          filteredAgents = filteredAgents.filter(a => a.tenant_count >= parseInt(minTenantsFilter));
        }
        if (maxTenantsFilter) {
          filteredAgents = filteredAgents.filter(a => a.tenant_count <= parseInt(maxTenantsFilter));
        }

        setSearchResults(filteredAgents);
        
        if (filteredAgents.length === 0) {
          toast.info("No agents found matching your search");
        }
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search agents");
    }
  };

  const clearTenantFilters = () => {
    setTenantStatusFilter("all");
    setMinBalanceFilter("");
    setMaxBalanceFilter("");
    setStartDateFilter(undefined);
    setEndDateFilter(undefined);
  };

  const clearAgentFilters = () => {
    setAgentStatusFilter("all");
    setMinTenantsFilter("");
    setMaxTenantsFilter("");
  };

  const calculateAgentGrowthComparison = async (agents: any[]) => {
    if (!agents || agents.length === 0) {
      setAgentGrowthComparison([]);
      return;
    }

    try {
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Fetch collections for all agents in the last week
      const { data: weekCollections } = await supabase
        .from("collections")
        .select("agent_id, amount")
        .eq("status", "verified")
        .gte("collection_date", lastWeek.toISOString().split('T')[0]);

      // Calculate growth for each agent
      const agentGrowthData = await Promise.all(
        agents.map(async (agent) => {
          // Get agent profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone_number")
            .eq("id", agent.user_id)
            .single();

          // Calculate weekly collections for this agent
          const agentWeekCollections = weekCollections?.filter(c => c.agent_id === agent.id) || [];
          const weeklyGrowth = agentWeekCollections.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0);
          
          // Calculate growth percentage relative to portfolio
          const portfolioValue = parseFloat(agent.portfolio_value?.toString() || '0');
          const growthPercent = portfolioValue > 0 ? (weeklyGrowth / portfolioValue) * 100 : 0;

          return {
            id: agent.id,
            name: profile?.full_name || 'Unknown Agent',
            portfolioValue,
            weeklyGrowth,
            growthPercent,
            tenantCount: agent.total_tenants || 0,
          };
        })
      );

      // Sort by growth percentage (highest first)
      agentGrowthData.sort((a, b) => b.growthPercent - a.growthPercent);

      setAgentGrowthComparison(agentGrowthData);
    } catch (error) {
      console.error("Error calculating agent growth comparison:", error);
      setAgentGrowthComparison([]);
    }
  };

  if (isLoading) {
    return (
      <ManagerLayout currentPage="/manager/dashboard">
        <ManagerDashboardSkeleton />
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/dashboard">
      <PullToRefresh onRefresh={handleRefresh} pullingContent="">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Manager Dashboard</h1>
            <p className="text-muted-foreground">Service Centre Overview</p>
          </div>

          {/* Quick Search Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Search Tenants
                </CardTitle>
                <CardDescription>
                  Find tenants by name or phone number
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => {
                  setShowTenantSearch(true);
                  setSearchResults([]);
                  setTenantSearchQuery("");
                  clearTenantFilters();
                  setShowAdvancedFilters(false);
                  }}
                >
                  <Search className="h-5 w-5 mr-2" />
                  Search Tenants
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Search Agents
                </CardTitle>
                <CardDescription>
                  Find agents by name or phone number
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => {
                  setShowAgentSearch(true);
                  setSearchResults([]);
                  setAgentSearchQuery("");
                  clearAgentFilters();
                  setShowAdvancedFilters(false);
                  }}
                >
                  <Search className="h-5 w-5 mr-2" />
                  Search Agents
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeAgents} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTenants}</div>
              <p className="text-xs text-success mt-1">Across all agents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pending Verifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {stats.pendingVerifications}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Requires action</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 cursor-pointer hover:border-primary/40 transition-all hover:shadow-lg"
            onClick={() => {
              haptics.light();
              navigate("/manager/portfolio-breakdown");
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Total Portfolio Value
                </div>
                <DataSyncBadge 
                  isSyncing={false} 
                  lastSyncTime={lastSyncTime}
                  label=""
                  className="text-xs"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                UGX {stats.totalPortfolioValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Combined outstanding balances • Tap for breakdown
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Verification Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Verification Overview</CardTitle>
            <CardDescription>
              Track all payment submissions and approvals across your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                className="text-center p-6 rounded-lg bg-orange-500/10 border-2 border-orange-500/20 cursor-pointer hover:border-orange-500/40 transition-colors"
                onClick={() => navigate("/manager/payment-verifications")}
              >
                <Clock className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <div className="text-4xl font-bold text-orange-500">{stats.pendingPayments}</div>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Pending Review</p>
              </div>
              <div 
                className="text-center p-6 rounded-lg bg-success/10 border-2 border-success/20 cursor-pointer hover:border-success/40 transition-colors"
                onClick={() => navigate("/manager/payment-verifications")}
              >
                <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                <div className="text-4xl font-bold text-success">{stats.verifiedPayments}</div>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Verified</p>
              </div>
              <div 
                className="text-center p-6 rounded-lg bg-destructive/10 border-2 border-destructive/20 cursor-pointer hover:border-destructive/40 transition-colors"
                onClick={() => navigate("/manager/payment-verifications")}
              >
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <div className="text-4xl font-bold text-destructive">{stats.rejectedPayments}</div>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Rejected</p>
              </div>
            </div>
            {stats.pendingPayments > 0 && (
              <div className="mt-4 p-4 bg-orange-500/5 rounded-lg border border-orange-500/20">
                <p className="text-sm text-center">
                  <AlertCircle className="h-4 w-4 inline mr-1 text-orange-500" />
                  <span className="font-medium">{stats.pendingPayments} payment{stats.pendingPayments !== 1 ? 's' : ''}</span> awaiting your verification
                </p>
              </div>
            )}
          </CardContent>
          </Card>

          {/* Portfolio Growth Tracking */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Portfolio Growth Tracking
              </CardTitle>
              <CardDescription>
                Monitor portfolio value changes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Day-over-Day Change */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-2 rounded-lg",
                        stats.portfolioDayChange >= 0 ? "bg-success/10" : "bg-destructive/10"
                      )}>
                        {stats.portfolioDayChange >= 0 ? (
                          <ArrowUp className="h-5 w-5 text-success" />
                        ) : (
                          <ArrowDown className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Daily Change</p>
                        <p className="text-xs text-muted-foreground">vs. Yesterday</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className={cn(
                      "text-3xl font-bold",
                      stats.portfolioDayChange >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {stats.portfolioDayChange >= 0 ? '+' : ''}UGX {Math.abs(stats.portfolioDayChange).toLocaleString()}
                    </div>
                    <div className={cn(
                      "text-sm font-medium flex items-center gap-1",
                      stats.portfolioDayChangePercent >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {stats.portfolioDayChangePercent >= 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {Math.abs(stats.portfolioDayChangePercent).toFixed(2)}%
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Collections verified yesterday
                    </p>
                  </div>
                </div>

                {/* Week-over-Week Change */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-2 rounded-lg",
                        stats.portfolioWeekChange >= 0 ? "bg-success/10" : "bg-destructive/10"
                      )}>
                        {stats.portfolioWeekChange >= 0 ? (
                          <ArrowUp className="h-5 w-5 text-success" />
                        ) : (
                          <ArrowDown className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Weekly Change</p>
                        <p className="text-xs text-muted-foreground">Last 7 Days</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className={cn(
                      "text-3xl font-bold",
                      stats.portfolioWeekChange >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {stats.portfolioWeekChange >= 0 ? '+' : ''}UGX {Math.abs(stats.portfolioWeekChange).toLocaleString()}
                    </div>
                    <div className={cn(
                      "text-sm font-medium flex items-center gap-1",
                      stats.portfolioWeekChangePercent >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {stats.portfolioWeekChangePercent >= 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {Math.abs(stats.portfolioWeekChangePercent).toFixed(2)}%
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Collections verified in past 7 days
                    </p>
                  </div>
                </div>
              </div>

              {/* Growth Summary */}
              <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Portfolio Performance</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.portfolioWeekChange >= 0 
                        ? `Your team's portfolio is growing! Weekly collections up by UGX ${stats.portfolioWeekChange.toLocaleString()}.`
                        : `Weekly collections decreased. Review agent performance to identify improvement areas.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Payment Method Breakdown
              </CardTitle>
              <CardDescription>
                Collections by payment method across all agents (Last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  amount: {
                    label: "Amount",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentMethodData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="method" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      content={
                        <ChartTooltipContent 
                          formatter={(value) => `UGX ${Number(value).toLocaleString()}`}
                        />
                      }
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="hsl(var(--primary))" 
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>

              {/* Trend Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {paymentMethodData.map((item, index) => (
                  <div 
                    key={index}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{item.method}</p>
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        item.trend > 0 ? "text-success" : item.trend < 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {item.trend > 0 ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : item.trend < 0 ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                        {Math.abs(item.trend).toFixed(1)}%
                      </div>
                    </div>
                    <p className="text-2xl font-bold">
                      UGX {item.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      vs. previous 30 days
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Agent Payment Method Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Agent Payment Method Preferences
              </CardTitle>
              <CardDescription>
                Compare payment method usage across top agents (Last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agentPaymentMethodData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No payment data available for agents
                </div>
              ) : (
                <div className="space-y-4">
                  {agentPaymentMethodData.map((agent, index) => (
                    <div 
                      key={agent.id}
                      className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/manager/agents/${agent.id}`)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-base">{agent.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Total: UGX {agent.total.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          #{index + 1}
                        </div>
                      </div>

                      {/* Payment Method Distribution Bars */}
                      <div className="space-y-2">
                        {/* Cash */}
                        {agent.cash > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Cash</span>
                              <span className="font-medium">
                                UGX {agent.cash.toLocaleString()} ({agent.cashPercent.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${agent.cashPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* MTN */}
                        {agent.mtn > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">MTN Mobile Money</span>
                              <span className="font-medium">
                                UGX {agent.mtn.toLocaleString()} ({agent.mtnPercent.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div 
                                className="bg-yellow-500 h-2 rounded-full transition-all"
                                style={{ width: `${agent.mtnPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Airtel */}
                        {agent.airtel > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Airtel Money</span>
                              <span className="font-medium">
                                UGX {agent.airtel.toLocaleString()} ({agent.airtelPercent.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div 
                                className="bg-red-500 h-2 rounded-full transition-all"
                                style={{ width: `${agent.airtelPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Preferred Method Badge */}
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Preferred method: 
                          <span className="ml-1 font-medium text-foreground">
                            {agent.cashPercent >= agent.mtnPercent && agent.cashPercent >= agent.airtelPercent
                              ? "Cash"
                              : agent.mtnPercent >= agent.airtelPercent
                              ? "MTN Mobile Money"
                              : "Airtel Money"}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Growth Comparison */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Agent Performance Comparison
              </CardTitle>
              <CardDescription>
                Weekly growth rates ranked by performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agentGrowthComparison.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Loading agent comparison data...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Top Performers */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="h-4 w-4 text-success" />
                      <h4 className="font-semibold text-sm">Top Performers</h4>
                    </div>
                    <div className="space-y-2">
                      {agentGrowthComparison.slice(0, 3).map((agent, index) => (
                        <div
                          key={agent.id}
                          className="p-4 rounded-lg border bg-success/5 border-success/20 cursor-pointer hover:bg-success/10 transition-colors"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success/20 text-success font-bold text-sm">
                                #{index + 1}
                              </div>
                              <div>
                                <p className="font-semibold">{agent.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {agent.tenantCount} tenant{agent.tenantCount !== 1 ? 's' : ''} • Portfolio: UGX {agent.portfolioValue.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-success font-bold">
                                <ArrowUp className="h-4 w-4" />
                                {agent.growthPercent.toFixed(2)}%
                              </div>
                              <p className="text-xs text-muted-foreground">
                                +UGX {agent.weeklyGrowth.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Performers */}
                  {agentGrowthComparison.length > 3 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-4 w-4 text-orange-500" />
                        <h4 className="font-semibold text-sm">Needs Support</h4>
                      </div>
                      <div className="space-y-2">
                        {agentGrowthComparison.slice(-3).reverse().map((agent, index) => (
                          <div
                            key={agent.id}
                            className="p-4 rounded-lg border bg-orange-500/5 border-orange-500/20 cursor-pointer hover:bg-orange-500/10 transition-colors"
                            onClick={() => navigate(`/manager/agents/${agent.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 font-bold text-sm">
                                  #{agentGrowthComparison.length - index}
                                </div>
                                <div>
                                  <p className="font-semibold">{agent.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {agent.tenantCount} tenant{agent.tenantCount !== 1 ? 's' : ''} • Portfolio: UGX {agent.portfolioValue.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={cn(
                                  "flex items-center gap-1 font-bold",
                                  agent.growthPercent >= 0 ? "text-success" : "text-destructive"
                                )}>
                                  {agent.growthPercent >= 0 ? (
                                    <ArrowUp className="h-4 w-4" />
                                  ) : (
                                    <ArrowDown className="h-4 w-4" />
                                  )}
                                  {agent.growthPercent >= 0 ? '+' : ''}{agent.growthPercent.toFixed(2)}%
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {agent.weeklyGrowth >= 0 ? '+' : ''}UGX {agent.weeklyGrowth.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View All Button */}
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => navigate("/manager/agent-comparison")}
                  >
                    View Detailed Comparison
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Access Card */}
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Access
            </CardTitle>
            <CardDescription>
              As a manager, you have admin privileges to manage users and system settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/admin')}
              className="w-full md:w-auto"
            >
              Open Admin Dashboard
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest tenant registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Monitor tenant additions in real-time
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="default">
                Pay All Verified Landlords
              </Button>
              <Button className="w-full" variant="outline">
                View Late Tenants
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-warning/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                {stats.pendingVerifications} landlord verifications are pending approval
              </p>
              <Button variant="default">Review Verifications</Button>
            </CardContent>
          </Card>
        </div>
      </div>
      </PullToRefresh>

      {/* Tenant Search Dialog */}
      <Dialog open={showTenantSearch} onOpenChange={setShowTenantSearch}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Tenants</DialogTitle>
            <DialogDescription>
              Search for tenants by name or phone number across all agents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter tenant name or phone number..."
                value={tenantSearchQuery}
                onChange={(e) => setTenantSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTenantSearch();
                  }
                }}
              />
              <Button onClick={handleTenantSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Advanced Filters Toggle */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
              Advanced Filters
            </Button>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <Card className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select value={tenantStatusFilter} onValueChange={setTenantStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Min Balance */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Min Balance (UGX)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 0"
                      value={minBalanceFilter}
                      onChange={(e) => setMinBalanceFilter(e.target.value)}
                    />
                  </div>

                  {/* Max Balance */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Max Balance (UGX)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 1000000"
                      value={maxBalanceFilter}
                      onChange={(e) => setMaxBalanceFilter(e.target.value)}
                    />
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Registration Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDateFilter && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDateFilter ? format(startDateFilter, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDateFilter}
                          onSelect={setStartDateFilter}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Registration End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDateFilter && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDateFilter ? format(endDateFilter, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDateFilter}
                          onSelect={setEndDateFilter}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearTenantFilters} className="flex-1">
                    Clear Filters
                  </Button>
                  <Button onClick={handleTenantSearch} className="flex-1">
                    Apply Filters
                  </Button>
                </div>
              </Card>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">Search Results ({searchResults.length})</h3>
                {searchResults.map((tenant: any) => (
                  <Card 
                    key={tenant.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      navigate(`/agent/tenants/${tenant.id}`);
                      setShowTenantSearch(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{tenant.tenant_name}</h4>
                          <p className="text-sm text-muted-foreground">{tenant.tenant_phone}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Agent: {tenant.agents?.profiles?.full_name || 'Unknown'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">UGX {Number(tenant.outstanding_balance || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Outstanding</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Agent Search Dialog */}
      <Dialog open={showAgentSearch} onOpenChange={setShowAgentSearch}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Agents</DialogTitle>
            <DialogDescription>
              Search for agents by name or phone number
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter agent name or phone number..."
                value={agentSearchQuery}
                onChange={(e) => setAgentSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAgentSearch();
                  }
                }}
              />
              <Button onClick={handleAgentSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Advanced Filters Toggle */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
              Advanced Filters
            </Button>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <Card className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select value={agentStatusFilter} onValueChange={setAgentStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Min Tenants */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Min Tenants</label>
                    <Input
                      type="number"
                      placeholder="e.g., 0"
                      value={minTenantsFilter}
                      onChange={(e) => setMinTenantsFilter(e.target.value)}
                    />
                  </div>

                  {/* Max Tenants */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Max Tenants</label>
                    <Input
                      type="number"
                      placeholder="e.g., 100"
                      value={maxTenantsFilter}
                      onChange={(e) => setMaxTenantsFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearAgentFilters} className="flex-1">
                    Clear Filters
                  </Button>
                  <Button onClick={handleAgentSearch} className="flex-1">
                    Apply Filters
                  </Button>
                </div>
              </Card>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">Search Results ({searchResults.length})</h3>
                {searchResults.map((agent: any) => (
                  <Card 
                    key={agent.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      navigate(`/manager/agents/${agent.id}`);
                      setShowAgentSearch(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{agent.profiles?.full_name || 'Unknown Agent'}</h4>
                          <p className="text-sm text-muted-foreground">{agent.profiles?.phone_number}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {agent.active_tenants || 0} active tenants
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{Number(agent.collection_rate || 0).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Collection Rate</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ManagerLayout>
  );
};

export default ManagerDashboard;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import ManagerLayout from "@/components/ManagerLayout";
import { ManagerDashboardSkeleton } from "@/components/TenantDetailSkeleton";
import { ContentTransition } from "@/components/ContentTransition";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, AlertCircle, TrendingUp, Shield, Search, CheckCircle2, XCircle, Clock, Wallet, ArrowUp, ArrowDown, Award, Target, Minus, HelpCircle, Calculator, Save, DollarSign, Download, FileText, X, UserPlus, Hash, Coins, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { useRealtimeAllTenants, useRealtimeAllCollections, useRealtimeAgents, useRealtimeLandlords, useRealtimePasswordRequests, registerSyncCallback } from "@/hooks/useRealtimeSubscription";
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
import { BulkMessageDialog } from "@/components/BulkMessageDialog";
import { MessageSquare } from "lucide-react";
import { PaymentBroadcastWidget } from "@/components/PaymentBroadcastWidget";
import { DailyRepaymentCalculatorDialog } from "@/components/DailyRepaymentCalculatorDialog";
import { useManagerTutorial } from "@/hooks/useManagerTutorial";
import ManagerPaymentDialog from "@/components/ManagerPaymentDialog";
import BatchPaymentDialog from "@/components/BatchPaymentDialog";
import AgentsList from "@/components/AgentsListWidget";
import { SkeletonWrapper } from "@/components/SkeletonWrapper";
import { useDebounce } from "@/hooks/useDebounce";
import { ManagerCommissionSummaryDialog } from "@/components/ManagerCommissionSummaryDialog";
import { Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalTenants: 0,
    activeTenants: 0,
    pipelineTenants: 0,
    overdueTenants: 0,
    totalLandlords: 0,
    totalTenantsRegistered: 0,
    pendingLandlordVerifications: 0,
    pendingVerifications: 0,
    pendingPayments: 0,
    verifiedPayments: 0,
    rejectedPayments: 0,
    totalPortfolioValue: 0,
    portfolioDayChange: 0,
    portfolioDayChangePercent: 0,
    portfolioWeekChange: 0,
    portfolioWeekChangePercent: 0,
    totalVerifiedCommission: 0,
    pendingPasswordRequests: 0,
  });
  const [commissionByMethod, setCommissionByMethod] = useState<any[]>([]);
  const [topAgentsByCommission, setTopAgentsByCommission] = useState<any[]>([]);
  const [commissionTimePeriod, setCommissionTimePeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [batchPaymentDialogOpen, setBatchPaymentDialogOpen] = useState(false);
  const [paymentReportOpen, setPaymentReportOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>(new Date());
  const [paymentReportData, setPaymentReportData] = useState({
    totalRent: 0,
    dailyBreakdown: [] as any[],
    weeklyBreakdown: [] as any[],
    paymentMethodBreakdown: [] as any[],
    managerLeaderboard: [] as any[]
  });
  const [showTenantSearch, setShowTenantSearch] = useState(false);
  const [showAgentSearch, setShowAgentSearch] = useState(false);
  const [tenantSearchQuery, setTenantSearchQuery] = useState("");
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
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
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [paymentMethodTimePeriod, setPaymentMethodTimePeriod] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('30d');
  const [paymentMethodCustomStartDate, setPaymentMethodCustomStartDate] = useState<Date | undefined>();
  const [paymentMethodCustomEndDate, setPaymentMethodCustomEndDate] = useState<Date | undefined>();
  const [landlordBreakdownOpen, setLandlordBreakdownOpen] = useState(false);
  const [tenantBreakdownOpen, setTenantBreakdownOpen] = useState(false);
  const [landlordAgentData, setLandlordAgentData] = useState<any[]>([]);
  const [tenantAgentData, setTenantAgentData] = useState<any[]>([]);
  const [landlordSortBy, setLandlordSortBy] = useState<'count' | 'name'>('count');
  const [tenantSortBy, setTenantSortBy] = useState<'count' | 'name'>('count');
  
  // Earnings filter states
  const [earningsFilterType, setEarningsFilterType] = useState<'all' | 'top' | 'low' | 'range'>('all');
  const [minEarningsFilter, setMinEarningsFilter] = useState<string>("");
  const [maxEarningsFilter, setMaxEarningsFilter] = useState<string>("");

  // Fetch payment report data with date range
  const fetchPaymentReportData = async (startDate?: Date, endDate?: Date) => {
    try {
      const start = startDate || reportStartDate;
      const end = endDate || reportEndDate;

      if (!start || !end) {
        toast.error('Please select a date range');
        return;
      }

      const startDateStr = start.toISOString().split('T')[0];
      const endDateStr = end.toISOString().split('T')[0];

      // Get all collections within date range (including pending verification)
      const { data: collections, error } = await supabase
        .from('collections')
        .select(`
          amount, 
          collection_date, 
          payment_method,
          verified_at,
          verified_by,
          status,
          tenants (
            tenant_name
          ),
          agents (
            profiles!agents_user_id_fkey (
              full_name
            )
          )
        `)
        .gte('collection_date', startDateStr)
        .lte('collection_date', endDateStr)
        .order('collection_date', { ascending: true });

      if (error) throw error;

      // Fetch manager names for verified_by
      const managerIds = [...new Set(collections?.map(c => c.verified_by).filter(Boolean))];
      const { data: managers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', managerIds);

      const managerMap = new Map(managers?.map(m => [m.id, m.full_name]));

      // Calculate total rent
      const totalRent = collections?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

      // Daily breakdown
      const dailyMap = new Map();
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dailyMap.set(dateStr, 0);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      collections?.forEach(c => {
        const dateStr = c.collection_date;
        if (dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, dailyMap.get(dateStr) + parseFloat(c.amount.toString()));
        }
      });

      const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, amount]) => ({
        date: format(new Date(date), 'MMM dd'),
        fullDate: date,
        amount,
        payments: collections?.filter(c => c.collection_date === date).map(c => ({
          amount: parseFloat(c.amount.toString()),
          tenantName: c.tenants?.tenant_name || 'Unknown',
          agentName: c.agents?.profiles?.full_name || 'Unknown',
          managerName: c.verified_by ? (managerMap.get(c.verified_by) || 'Unknown') : 'Pending Verification',
          verifiedAt: c.verified_at,
          paymentMethod: c.payment_method,
          status: c.status || 'pending'
        })) || []
      }));

      // Weekly breakdown - group by weeks within the selected range
      const weeklyMap = new Map();
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const weeksCount = Math.min(Math.ceil(daysDiff / 7), 8);

      for (let i = 0; i < weeksCount; i++) {
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Don't exceed the end date
        if (weekEnd > end) {
          weekEnd.setTime(end.getTime());
        }

        const weekLabel = `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
        weeklyMap.set(weekLabel, { 
          start: weekStart.toISOString().split('T')[0], 
          end: weekEnd.toISOString().split('T')[0], 
          amount: 0 
        });
      }

      collections?.forEach(c => {
        weeklyMap.forEach((value, key) => {
          if (c.collection_date >= value.start && c.collection_date <= value.end) {
            value.amount += parseFloat(c.amount.toString());
          }
        });
      });

      const weeklyBreakdown = Array.from(weeklyMap.entries()).map(([week, data]) => ({
        week,
        amount: data.amount
      }));

      // Payment method breakdown
      const methodMap = new Map([
        ['cash', 0],
        ['mtn', 0],
        ['airtel', 0]
      ]);

      collections?.forEach(c => {
        const method = (c.payment_method || 'cash').toLowerCase();
        if (methodMap.has(method)) {
          methodMap.set(method, methodMap.get(method)! + parseFloat(c.amount.toString()));
        }
      });

      const paymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, amount]) => ({
        method: method === 'cash' ? 'Cash' : method === 'mtn' ? 'MTN' : 'Airtel',
        amount
      }));

      // Manager leaderboard - group by manager
      const managerStatsMap = new Map();
      collections?.forEach(c => {
        if (c.verified_by) {
          const managerId = c.verified_by;
          const managerName = managerMap.get(managerId) || 'Unknown Manager';
          
          if (!managerStatsMap.has(managerId)) {
            managerStatsMap.set(managerId, {
              managerId,
              managerName,
              verificationCount: 0,
              totalAmount: 0
            });
          }
          
          const stats = managerStatsMap.get(managerId);
          stats.verificationCount += 1;
          stats.totalAmount += parseFloat(c.amount.toString());
        }
      });

      const managerLeaderboard = Array.from(managerStatsMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount);

      setPaymentReportData({
        totalRent,
        dailyBreakdown,
        weeklyBreakdown,
        paymentMethodBreakdown,
        managerLeaderboard
      });
    } catch (error) {
      console.error('Error fetching payment report:', error);
      toast.error('Failed to load payment report');
    }
  };

  // Quick filter handlers
  const handleQuickFilter = (type: 'last24h' | 'last7d' | 'last30d' | 'last90d') => {
    const end = new Date();
    const start = new Date();

    switch (type) {
      case 'last24h':
        start.setDate(start.getDate() - 1);
        break;
      case 'last7d':
        start.setDate(start.getDate() - 7);
        break;
      case 'last30d':
        start.setDate(start.getDate() - 30);
        break;
      case 'last90d':
        start.setDate(start.getDate() - 90);
        break;
    }

    setReportStartDate(start);
    setReportEndDate(end);
    setPaymentStatusFilter('all'); // Reset status filter
    fetchPaymentReportData(start, end);
    haptics.light();
  };

  // Filter payment data by status
  const getFilteredPaymentData = () => {
    if (paymentStatusFilter === 'all') {
      return paymentReportData;
    }

    const filteredDailyBreakdown = paymentReportData.dailyBreakdown.map(day => {
      const filteredPayments = day.payments.filter((p: any) => p.status === paymentStatusFilter);
      const filteredAmount = filteredPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
      return {
        ...day,
        payments: filteredPayments,
        amount: filteredAmount
      };
    });

    const filteredTotalRent = filteredDailyBreakdown.reduce((sum, day) => sum + day.amount, 0);

    // Recalculate weekly breakdown based on filtered daily data
    const weeklyMap = new Map();
    paymentReportData.weeklyBreakdown.forEach(week => {
      weeklyMap.set(week.week, 0);
    });

    filteredDailyBreakdown.forEach(day => {
      paymentReportData.weeklyBreakdown.forEach(week => {
        // Find which week this day belongs to by checking the original mapping
        const originalWeekData = paymentReportData.dailyBreakdown.find(d => d.date === day.date);
        if (originalWeekData) {
          weeklyMap.set(week.week, (weeklyMap.get(week.week) || 0) + day.amount);
        }
      });
    });

    const filteredWeeklyBreakdown = Array.from(weeklyMap.entries()).map(([week, amount]) => ({
      week,
      amount
    }));

    // Recalculate payment method breakdown
    const methodMap = new Map([
      ['cash', 0],
      ['mtn', 0],
      ['airtel', 0]
    ]);

    filteredDailyBreakdown.forEach(day => {
      day.payments.forEach((p: any) => {
        const method = (p.paymentMethod || 'cash').toLowerCase();
        if (methodMap.has(method)) {
          methodMap.set(method, methodMap.get(method)! + p.amount);
        }
      });
    });

    const filteredPaymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, amount]) => ({
      method: method === 'cash' ? 'Cash' : method === 'mtn' ? 'MTN' : 'Airtel',
      amount
    }));

    // Filter manager leaderboard - only include managers who verified the filtered payments
    const managerStatsMap = new Map();
    filteredDailyBreakdown.forEach(day => {
      day.payments.forEach((p: any) => {
        if (p.status === 'verified' && p.managerName && p.managerName !== 'Unknown') {
          if (!managerStatsMap.has(p.managerName)) {
            managerStatsMap.set(p.managerName, {
              managerName: p.managerName,
              verificationCount: 0,
              totalAmount: 0
            });
          }
          const stats = managerStatsMap.get(p.managerName);
          stats.verificationCount += 1;
          stats.totalAmount += p.amount;
        }
      });
    });

    const filteredManagerLeaderboard = Array.from(managerStatsMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalRent: filteredTotalRent,
      dailyBreakdown: filteredDailyBreakdown,
      weeklyBreakdown: filteredWeeklyBreakdown,
      paymentMethodBreakdown: filteredPaymentMethodBreakdown,
      managerLeaderboard: filteredManagerLeaderboard
    };
  };

  // Track previous values for change detection
  const [prevPortfolioValue, setPrevPortfolioValue] = useState<number | null>(null);
  const [prevTotalTenants, setPrevTotalTenants] = useState<number | null>(null);
  const [prevPendingVerifications, setPrevPendingVerifications] = useState<number | null>(null);
  const [prevPendingPayments, setPrevPendingPayments] = useState<number | null>(null);
  const [prevPasswordRequests, setPrevPasswordRequests] = useState<number | null>(null);

  // Subscribe to real-time updates for all agent activity
  useRealtimeAllTenants();
  useRealtimeAllCollections();
  useRealtimeAgents();
  useRealtimeLandlords();
  useRealtimePasswordRequests();

  // Track sync status for tenants table (for portfolio value updates)
  const { lastSyncTime } = useRealtimeSyncStatus('tenants');
  const { lastSyncTime: passwordRequestsSyncTime } = useRealtimeSyncStatus('password_change_requests');

  // Tutorial/onboarding flow
  const { hasCompletedTutorial, startTutorial } = useManagerTutorial();

  // Auto-start tutorial on first login
  useEffect(() => {
    if (!isLoading && !hasCompletedTutorial) {
      // Delay to ensure DOM elements are rendered
      const timer = setTimeout(() => {
        startTutorial();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, hasCompletedTutorial]);

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

  // Show toast notification when password change requests arrive
  useEffect(() => {
    if (prevPasswordRequests !== null && stats.pendingPasswordRequests !== prevPasswordRequests) {
      const difference = stats.pendingPasswordRequests - prevPasswordRequests;
      const isIncrease = difference > 0;
      
      if (isIncrease) {
        toast.info(
          `New Password Change Request${Math.abs(difference) > 1 ? 's' : ''}`,
          {
            description: `${Math.abs(difference)} agent${Math.abs(difference) > 1 ? 's' : ''} requesting password change`,
            duration: 5000,
            action: {
              label: "Review",
              onClick: () => navigate("/manager/password-requests"),
            },
          }
        );
        haptics.light();
      }
    }
    
    setPrevPasswordRequests(stats.pendingPasswordRequests);
  }, [stats.pendingPasswordRequests]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Show dashboard immediately with loading states for individual cards
        setIsLoading(false);
        
        // Fetch only essential counts first (parallel + optimized)
        const [agentsCount, tenantsCount, pendingVerificationsCount, collectionsData, landlordsData, tenantsRegisteredData, passwordRequestsData] = await Promise.all([
          supabase.from("agents").select("*", { count: 'exact', head: false }),
          supabase.from("tenants").select("outstanding_balance, status, next_payment_date"),
          supabase.from("tenants").select("*", { count: 'exact', head: true }).eq("status", "pending"),
          supabase.from("collections").select("status"),
          supabase.from("landlords").select(`
            id,
            landlord_name,
            landlord_phone,
            registered_by,
            is_verified,
            created_at
          `),
          supabase.from("tenants").select(`
            id,
            tenant_name,
            agent_id,
            created_at
          `),
          supabase.from("password_change_requests").select("*", { count: 'exact', head: true }).eq("status", "pending"),
        ]);

        const totalAgents = agentsCount.data?.length || 0;
        const totalTenants = tenantsCount.data?.length || 0;
        const activeTenants = tenantsCount.data?.filter(t => (parseFloat(t.outstanding_balance?.toString() || '0') > 0)).length || 0;
        const pipelineTenants = tenantsCount.data?.filter(t => (parseFloat(t.outstanding_balance?.toString() || '0') === 0)).length || 0;
        
        // Calculate overdue tenants
        const today = new Date();
        const overdueTenants = tenantsCount.data?.filter(t => {
          if (!t.next_payment_date) return false;
          const nextPayment = new Date(t.next_payment_date);
          return nextPayment < today && ['verified', 'active'].includes(t.status || '');
        }).length || 0;
        
        const totalLandlords = landlordsData.data?.length || 0;
        const totalTenantsRegistered = tenantsRegisteredData.data?.length || 0;
        const pendingLandlordVerifications = landlordsData.data?.filter(l => !l.is_verified).length || 0;
        const pendingVerifications = pendingVerificationsCount.count || 0;

        // Calculate portfolio value from fetched tenant balances
        const totalPortfolioValue = tenantsCount.data?.reduce((sum, tenant) => {
          return sum + (parseFloat(tenant.outstanding_balance?.toString() || '0'));
        }, 0) || 0;

        // Process payment stats from already fetched collections
        const pendingPayments = collectionsData.data?.filter(c => c.status === 'pending').length || 0;
        const verifiedPayments = collectionsData.data?.filter(c => c.status === 'verified').length || 0;
        const rejectedPayments = collectionsData.data?.filter(c => c.status === 'rejected').length || 0;

        // Fetch total verified commission and breakdown by payment method
        const { data: verifiedCollections } = await supabase
          .from("collections")
          .select("commission, payment_method")
          .eq("status", "verified");
        
        const totalVerifiedCommission = verifiedCollections?.reduce(
          (sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 
          0
        ) || 0;

        // Calculate commission by payment method
        const commissionBreakdown = {
          cash: verifiedCollections?.filter(c => c.payment_method === 'cash').reduce((sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 0) || 0,
          mtn: verifiedCollections?.filter(c => c.payment_method === 'mtn').reduce((sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 0) || 0,
          airtel: verifiedCollections?.filter(c => c.payment_method === 'airtel').reduce((sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 0) || 0,
        };

        const commissionMethodData = [
          { method: 'Cash', commission: commissionBreakdown.cash, percentage: totalVerifiedCommission > 0 ? (commissionBreakdown.cash / totalVerifiedCommission) * 100 : 0 },
          { method: 'MTN Mobile Money', commission: commissionBreakdown.mtn, percentage: totalVerifiedCommission > 0 ? (commissionBreakdown.mtn / totalVerifiedCommission) * 100 : 0 },
          { method: 'Airtel Money', commission: commissionBreakdown.airtel, percentage: totalVerifiedCommission > 0 ? (commissionBreakdown.airtel / totalVerifiedCommission) * 100 : 0 },
        ].filter(item => item.commission > 0);

        setCommissionByMethod(commissionMethodData);

        // Fetch top agents by commission (default to 30 days)
        await fetchTopAgentsByCommission('30d');

        setStats({
          totalAgents,
          activeAgents: totalAgents,
          totalTenants,
          activeTenants,
          pipelineTenants,
          overdueTenants,
          totalLandlords,
          totalTenantsRegistered,
          pendingLandlordVerifications,
          pendingVerifications,
          pendingPayments,
          verifiedPayments,
          rejectedPayments,
          totalPortfolioValue,
          portfolioDayChange: 0,
          portfolioDayChangePercent: 0,
          portfolioWeekChange: 0,
          portfolioWeekChangePercent: 0,
          totalVerifiedCommission,
          pendingPasswordRequests: passwordRequestsData.count || 0,
        });

        // Load secondary data in background (non-blocking)
        setTimeout(async () => {
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const lastWeek = new Date(today);
          lastWeek.setDate(lastWeek.getDate() - 7);

          const [yesterdayCollections, weekCollections] = await Promise.all([
            supabase
              .from("collections")
              .select("amount")
              .eq("status", "verified")
              .gte("collection_date", yesterday.toISOString().split('T')[0])
              .lt("collection_date", today.toISOString().split('T')[0]),
            supabase
              .from("collections")
              .select("amount")
              .eq("status", "verified")
              .gte("collection_date", lastWeek.toISOString().split('T')[0])
          ]);

          const yesterdayTotal = yesterdayCollections.data?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;
          const thisWeekTotal = weekCollections.data?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

          const portfolioDayChange = yesterdayTotal;
          const portfolioDayChangePercent = totalPortfolioValue > 0 ? (portfolioDayChange / totalPortfolioValue) * 100 : 0;
          const portfolioWeekChange = thisWeekTotal;
          const portfolioWeekChangePercent = totalPortfolioValue > 0 ? (portfolioWeekChange / totalPortfolioValue) * 100 : 0;

          setStats(prev => ({
            ...prev,
            portfolioDayChange,
            portfolioDayChangePercent,
            portfolioWeekChange,
            portfolioWeekChangePercent,
          }));

          // Load agent growth and payment method data
          if (agentsCount.data) {
            await calculateAgentGrowthComparison(agentsCount.data);
            await fetchAgentPaymentMethodBreakdown(agentsCount.data, paymentMethodTimePeriod);
          }
          await fetchPaymentMethodBreakdown(paymentMethodTimePeriod);
        }, 100);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
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
    
    // Quick refresh of essential data only
    const [agentsResult, tenantsResult, collectionsData] = await Promise.all([
      supabase.from("agents").select("*"),
      supabase.from("tenants").select("outstanding_balance, status"),
      supabase.from("collections").select("status")
    ]);

    const totalAgents = agentsResult.data?.length || 0;
    const totalTenants = tenantsResult.data?.length || 0;
    const activeTenants = tenantsResult.data?.filter(t => (parseFloat(t.outstanding_balance?.toString() || '0') > 0)).length || 0;
    const pipelineTenants = tenantsResult.data?.filter(t => (parseFloat(t.outstanding_balance?.toString() || '0') === 0)).length || 0;
    const pendingVerifications = tenantsResult.data?.filter(t => t.status === 'pending').length || 0;

    const totalPortfolioValue = tenantsResult.data?.reduce((sum, tenant) => {
      return sum + (parseFloat(tenant.outstanding_balance?.toString() || '0'));
    }, 0) || 0;

    const pendingPayments = collectionsData.data?.filter(c => c.status === 'pending').length || 0;
    const verifiedPayments = collectionsData.data?.filter(c => c.status === 'verified').length || 0;
    const rejectedPayments = collectionsData.data?.filter(c => c.status === 'rejected').length || 0;

    // Fetch total verified commission and breakdown by payment method for refresh
    const { data: verifiedCollections } = await supabase
      .from("collections")
      .select("commission, payment_method")
      .eq("status", "verified");
    
    const totalVerifiedCommission = verifiedCollections?.reduce(
      (sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 
      0
    ) || 0;

    // Calculate commission by payment method
    const commissionBreakdown = {
      cash: verifiedCollections?.filter(c => c.payment_method === 'cash').reduce((sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 0) || 0,
      mtn: verifiedCollections?.filter(c => c.payment_method === 'mtn').reduce((sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 0) || 0,
      airtel: verifiedCollections?.filter(c => c.payment_method === 'airtel').reduce((sum, c) => sum + parseFloat(c.commission?.toString() || '0'), 0) || 0,
    };

    const commissionMethodData = [
      { method: 'Cash', commission: commissionBreakdown.cash, percentage: totalVerifiedCommission > 0 ? (commissionBreakdown.cash / totalVerifiedCommission) * 100 : 0 },
      { method: 'MTN Mobile Money', commission: commissionBreakdown.mtn, percentage: totalVerifiedCommission > 0 ? (commissionBreakdown.mtn / totalVerifiedCommission) * 100 : 0 },
      { method: 'Airtel Money', commission: commissionBreakdown.airtel, percentage: totalVerifiedCommission > 0 ? (commissionBreakdown.airtel / totalVerifiedCommission) * 100 : 0 },
    ].filter(item => item.commission > 0);

    setCommissionByMethod(commissionMethodData);

    // Refresh top agents leaderboard with current time period
    await fetchTopAgentsByCommission(commissionTimePeriod);

    setStats(prev => ({
      ...prev,
      totalAgents,
      activeAgents: totalAgents,
      totalTenants,
      activeTenants,
      pipelineTenants,
      pendingVerifications,
      pendingPayments,
      verifiedPayments,
      rejectedPayments,
      totalPortfolioValue,
      totalVerifiedCommission,
    }));

    toast.success("Dashboard refreshed");
  };

  const fetchTopAgentsByCommission = async (timePeriod: '7d' | '30d' | 'all' = '30d') => {
    try {
      // Build date filter based on time period
      let dateFilter: any = supabase
        .from("collections")
        .select(`
          commission,
          payment_method,
          agent_id,
          collection_date,
          agents!inner(
            id,
            user_id,
            profiles!agents_user_id_fkey(
              full_name,
              phone_number
            )
          )
        `)
        .eq("status", "verified");

      // Apply date range filter
      if (timePeriod !== 'all') {
        const now = new Date();
        const daysAgo = timePeriod === '7d' ? 7 : 30;
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - daysAgo);
        
        dateFilter = dateFilter.gte("collection_date", startDate.toISOString().split('T')[0]);
      }

      const { data: verifiedCollections } = await dateFilter;

      if (!verifiedCollections) return;

      // Group by agent and calculate totals
      const agentCommissionMap = new Map();

      verifiedCollections.forEach((collection: any) => {
        const agentId = collection.agent_id;
        const agentName = collection.agents?.profiles?.full_name || collection.agents?.profiles?.phone_number || 'Unknown Agent';
        const commission = parseFloat(collection.commission?.toString() || '0');
        const paymentMethod = collection.payment_method || 'cash';

        if (!agentCommissionMap.has(agentId)) {
          agentCommissionMap.set(agentId, {
            agentId,
            agentName,
            totalCommission: 0,
            paymentMethods: { cash: 0, mtn: 0, airtel: 0 },
            paymentCount: 0,
          });
        }

        const agentData = agentCommissionMap.get(agentId);
        agentData.totalCommission += commission;
        agentData.paymentMethods[paymentMethod] = (agentData.paymentMethods[paymentMethod] || 0) + 1;
        agentData.paymentCount += 1;
      });

      // Fetch tenant counts for each agent
      const agentIds = Array.from(agentCommissionMap.keys());
      const { data: agents } = await supabase
        .from("agents")
        .select("id, total_tenants, wallet_balance, monthly_earnings, portfolio_value, collection_rate")
        .in("id", agentIds);

      // Create maps for agent data
      const tenantCountMap = new Map(
        agents?.map(agent => [agent.id, agent.total_tenants || 0]) || []
      );
      const walletBalanceMap = new Map(
        agents?.map(agent => [agent.id, agent.wallet_balance || 0]) || []
      );
      const monthlyEarningsMap = new Map(
        agents?.map(agent => [agent.id, agent.monthly_earnings || 0]) || []
      );
      const portfolioValueMap = new Map(
        agents?.map(agent => [agent.id, agent.portfolio_value || 0]) || []
      );
      const collectionRateMap = new Map(
        agents?.map(agent => [agent.id, agent.collection_rate || 0]) || []
      );

      // Convert to array and calculate metrics
      const agentLeaderboard = Array.from(agentCommissionMap.values()).map(agent => {
        const preferredMethod = Object.entries(agent.paymentMethods)
          .sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
        
        const preferredMethodDisplay = 
          preferredMethod === 'cash' ? 'Cash' :
          preferredMethod === 'mtn' ? 'MTN Mobile Money' :
          'Airtel Money';

        const averageCommission = agent.paymentCount > 0 
          ? agent.totalCommission / agent.paymentCount 
          : 0;

        const tenantCount = tenantCountMap.get(agent.agentId) || 0;
        const efficiencyScore = tenantCount > 0 
          ? agent.totalCommission / tenantCount 
          : 0;

        return {
          ...agent,
          preferredMethod: preferredMethodDisplay,
          averageCommission,
          tenantCount,
          efficiencyScore,
          walletBalance: walletBalanceMap.get(agent.agentId) || 0,
          monthlyEarnings: monthlyEarningsMap.get(agent.agentId) || 0,
          portfolioValue: portfolioValueMap.get(agent.agentId) || 0,
          collectionRate: collectionRateMap.get(agent.agentId) || 0,
        };
      });

      // Sort by total commission (descending) and take top 5
      agentLeaderboard.sort((a, b) => b.totalCommission - a.totalCommission);
      setTopAgentsByCommission(agentLeaderboard.slice(0, 5));
    } catch (error) {
      console.error("Error fetching top agents by commission:", error);
      setTopAgentsByCommission([]);
    }
  };

  const fetchPaymentMethodBreakdown = async (timePeriod: '7d' | '30d' | '90d' | 'all' | 'custom' = '30d', customStart?: Date, customEnd?: Date) => {
    try {
      const now = new Date();
      let currentPeriodStart: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;
      
      // Calculate date ranges based on time period
      if (timePeriod === 'custom') {
        if (!customStart || !customEnd) {
          toast.error('Please select both start and end dates');
          return;
        }
        currentPeriodStart = customStart;
        // For custom range, compare with same-length period before
        const daysDiff = Math.ceil((customEnd.getTime() - customStart.getTime()) / (1000 * 60 * 60 * 24));
        previousPeriodStart = new Date(customStart);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - daysDiff);
        previousPeriodEnd = new Date(customStart);
      } else {
        switch (timePeriod) {
          case '7d':
            currentPeriodStart = new Date(now);
            currentPeriodStart.setDate(currentPeriodStart.getDate() - 7);
            previousPeriodStart = new Date(now);
            previousPeriodStart.setDate(previousPeriodStart.getDate() - 14);
            previousPeriodEnd = new Date(currentPeriodStart);
            break;
          case '90d':
            currentPeriodStart = new Date(now);
            currentPeriodStart.setDate(currentPeriodStart.getDate() - 90);
            previousPeriodStart = new Date(now);
            previousPeriodStart.setDate(previousPeriodStart.getDate() - 180);
            previousPeriodEnd = new Date(currentPeriodStart);
            break;
          case 'all':
            // For "all time", compare current data vs data from 90 days ago
            currentPeriodStart = new Date('2000-01-01'); // Far back enough to get all data
            previousPeriodStart = new Date(now);
            previousPeriodStart.setDate(previousPeriodStart.getDate() - 180);
            previousPeriodEnd = new Date(now);
            previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 90);
            break;
          default: // 30d
            currentPeriodStart = new Date(now);
            currentPeriodStart.setDate(currentPeriodStart.getDate() - 30);
            previousPeriodStart = new Date(now);
            previousPeriodStart.setDate(previousPeriodStart.getDate() - 60);
            previousPeriodEnd = new Date(currentPeriodStart);
            break;
        }
      }

      // Fetch current period - ALL payments regardless of status
      let currentQuery = supabase
        .from("collections")
        .select("amount, payment_method");
      
      if (timePeriod === 'custom') {
        currentQuery = currentQuery
          .gte("collection_date", currentPeriodStart.toISOString().split('T')[0])
          .lte("collection_date", (customEnd || now).toISOString().split('T')[0]);
      } else if (timePeriod !== 'all') {
        currentQuery = currentQuery.gte("collection_date", currentPeriodStart.toISOString().split('T')[0]);
      }
      
      const { data: currentPeriod } = await currentQuery;

      // Fetch previous period - ALL payments regardless of status
      const { data: previousPeriod } = await supabase
        .from("collections")
        .select("amount, payment_method")
        .gte("collection_date", previousPeriodStart.toISOString().split('T')[0])
        .lt("collection_date", previousPeriodEnd.toISOString().split('T')[0]);

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

  const fetchLandlordAgentBreakdown = async () => {
    try {
      const { data: landlords, error } = await supabase
        .from("landlords")
        .select(`
          id,
          landlord_name,
          registered_by,
          created_at,
          agents!landlords_registered_by_fkey(
            id,
            profiles!agents_user_id_fkey(full_name)
          )
        `);

      if (error) throw error;

      // Group by agent
      const agentMap = new Map();
      landlords?.forEach((landlord: any) => {
        const agentId = landlord.registered_by;
        const agentName = landlord.agents?.profiles?.full_name || 'Unknown Agent';
        
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            agentId,
            agentName,
            count: 0,
            landlords: []
          });
        }
        
        const agentData = agentMap.get(agentId);
        agentData.count += 1;
        agentData.landlords.push({
          name: landlord.landlord_name,
          registeredAt: landlord.created_at
        });
      });

      const breakdown = Array.from(agentMap.values());
      setLandlordAgentData(breakdown);
      setLandlordBreakdownOpen(true);
    } catch (error) {
      console.error('Error fetching landlord breakdown:', error);
      toast.error('Failed to load landlord breakdown');
    }
  };

  const fetchTenantAgentBreakdown = async () => {
    try {
      const { data: tenants, error } = await supabase
        .from("tenants")
        .select(`
          id,
          tenant_name,
          agent_id,
          created_at,
          agents!tenants_agent_id_fkey(
            id,
            profiles!agents_user_id_fkey(full_name)
          )
        `);

      if (error) throw error;

      // Group by agent
      const agentMap = new Map();
      tenants?.forEach((tenant: any) => {
        const agentId = tenant.agent_id;
        const agentName = tenant.agents?.profiles?.full_name || 'Unknown Agent';
        
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            agentId,
            agentName,
            count: 0,
            tenants: []
          });
        }
        
        const agentData = agentMap.get(agentId);
        agentData.count += 1;
        agentData.tenants.push({
          name: tenant.tenant_name,
          registeredAt: tenant.created_at
        });
      });

      const breakdown = Array.from(agentMap.values());
      setTenantAgentData(breakdown);
      setTenantBreakdownOpen(true);
    } catch (error) {
      console.error('Error fetching tenant breakdown:', error);
      toast.error('Failed to load tenant breakdown');
    }
  };

  const fetchAgentPaymentMethodBreakdown = async (agents: any[], timePeriod: '7d' | '30d' | '90d' | 'all' | 'custom' = '30d', customStart?: Date, customEnd?: Date) => {
    if (!agents || agents.length === 0) {
      setAgentPaymentMethodData([]);
      return;
    }

    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      
      // Calculate start date based on time period
      if (timePeriod === 'custom') {
        if (!customStart || !customEnd) {
          toast.error('Please select both start and end dates');
          return;
        }
        startDate = customStart;
        endDate = customEnd;
      } else {
        switch (timePeriod) {
          case '7d':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '90d':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 90);
            break;
          case 'all':
            startDate = new Date('2000-01-01'); // Far back enough to get all data
            break;
          default: // 30d
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30);
            break;
        }
      }

      // Fetch collections for all agents - ALL payments regardless of status
      let query = supabase
        .from("collections")
        .select("agent_id, amount, payment_method");
      
      if (timePeriod === 'custom') {
        query = query
          .gte("collection_date", startDate.toISOString().split('T')[0])
          .lte("collection_date", endDate.toISOString().split('T')[0]);
      } else if (timePeriod !== 'all') {
        query = query.gte("collection_date", startDate.toISOString().split('T')[0]);
      }
      
      const { data: collections } = await query;

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

  // Export payment method data as CSV
  const exportPaymentMethodCSV = () => {
    try {
      const timePeriodLabel = 
        paymentMethodTimePeriod === '7d' ? 'Last 7 Days' :
        paymentMethodTimePeriod === '30d' ? 'Last 30 Days' :
        paymentMethodTimePeriod === '90d' ? 'Last 90 Days' :
        'All Time';

      let csvContent = `Payment Method Breakdown Report\n`;
      csvContent += `Period: ${timePeriodLabel}\n`;
      csvContent += `Generated: ${format(new Date(), 'PPP')}\n\n`;
      
      csvContent += `Payment Method,Amount (UGX),Trend (%)\n`;
      
      paymentMethodData.forEach(item => {
        csvContent += `${item.method},${item.amount.toFixed(2)},${item.trend.toFixed(2)}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `payment-method-breakdown-${paymentMethodTimePeriod === 'custom' ? 'custom' : paymentMethodTimePeriod}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('CSV exported successfully');
      haptics.success();
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  // Export payment method data as PDF
  const exportPaymentMethodPDF = () => {
    try {
      const doc = new jsPDF();
      const timePeriodLabel = 
        paymentMethodTimePeriod === '7d' ? 'Last 7 Days' :
        paymentMethodTimePeriod === '30d' ? 'Last 30 Days' :
        paymentMethodTimePeriod === '90d' ? 'Last 90 Days' :
        paymentMethodTimePeriod === 'custom' && paymentMethodCustomStartDate && paymentMethodCustomEndDate
          ? `${format(paymentMethodCustomStartDate, 'MMM dd, yyyy')} - ${format(paymentMethodCustomEndDate, 'MMM dd, yyyy')}`
          : 'All Time';

      // Header with purple background
      doc.setFillColor(107, 45, 197); // #6B2DC5
      doc.rect(0, 0, 210, 35, 'F');
      
      // Logo text
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text('Welile', 15, 20);
      
      // Report title
      doc.setFontSize(14);
      doc.text('Payment Method Breakdown Report', 15, 30);
      
      // Report details
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Period: ${timePeriodLabel}`, 15, 45);
      doc.text(`Generated: ${format(new Date(), 'PPP')}`, 15, 52);
      
      // Summary statistics
      const totalAmount = paymentMethodData.reduce((sum, item) => sum + item.amount, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Collections: UGX ${totalAmount.toLocaleString()}`, 15, 62);
      
      // Payment method breakdown table
      const tableData = paymentMethodData.map(item => [
        item.method,
        `UGX ${item.amount.toLocaleString()}`,
        `${item.trend > 0 ? '+' : ''}${item.trend.toFixed(1)}%`,
        `${((item.amount / totalAmount) * 100).toFixed(1)}%`
      ]);
      
      autoTable(doc, {
        startY: 70,
        head: [['Payment Method', 'Amount', 'Trend', '% of Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [107, 45, 197],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        styles: { 
          fontSize: 10,
          cellPadding: 5
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 50, halign: 'right' },
          2: { cellWidth: 40, halign: 'center' },
          3: { cellWidth: 40, halign: 'center' }
        }
      });
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
      
      doc.save(`payment-method-breakdown-${paymentMethodTimePeriod === 'custom' ? 'custom' : paymentMethodTimePeriod}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exported successfully');
      haptics.success();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleTenantSearch = async () => {
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
        `);

      // Apply text search if query is provided
      if (tenantSearchQuery.trim()) {
        query = query.or(`tenant_name.ilike.%${tenantSearchQuery}%,tenant_phone.ilike.%${tenantSearchQuery}%`);
      }

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

      // Order by name for easier browsing
      query = query.order("tenant_name", { ascending: true });

      const { data, error } = await query.limit(50);

      if (error) throw error;

      setSearchResults(data || []);
      
      if (!data || data.length === 0) {
        toast.info("No tenants found matching your search");
      } else {
        toast.success(`Found ${data.length} tenant${data.length > 1 ? 's' : ''}`);
        haptics.success();
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

  // Debounce the search query for autocomplete
  const debouncedSearchQuery = useDebounce(tenantSearchQuery, 300);

  // Filter agents by earnings criteria
  const getFilteredAgentsByEarnings = () => {
    if (earningsFilterType === 'all') {
      return topAgentsByCommission;
    }

    let filtered = [...topAgentsByCommission];

    // Filter by top earners (top 30%)
    if (earningsFilterType === 'top') {
      const topCount = Math.max(1, Math.ceil(filtered.length * 0.3));
      filtered = filtered.slice(0, topCount);
    }

    // Filter by low performers (bottom 30%)
    if (earningsFilterType === 'low') {
      const lowCount = Math.max(1, Math.ceil(filtered.length * 0.3));
      filtered = filtered.slice(-lowCount);
    }

    // Filter by earning range
    if (earningsFilterType === 'range') {
      const minEarnings = parseFloat(minEarningsFilter) || 0;
      const maxEarnings = parseFloat(maxEarningsFilter) || Infinity;
      filtered = filtered.filter(agent => 
        agent.totalCommission >= minEarnings && agent.totalCommission <= maxEarnings
      );
    }

    return filtered;
  };

  // Helper function to highlight matching text in autocomplete suggestions
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-primary/20 text-primary font-semibold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Fetch autocomplete suggestions
  useEffect(() => {
    const fetchAutocompleteSuggestions = async () => {
      if (!debouncedSearchQuery.trim() || debouncedSearchQuery.length < 2) {
        setAutocompleteSuggestions([]);
        setShowAutocomplete(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("tenants")
          .select(`
            id,
            tenant_name,
            tenant_phone,
            outstanding_balance,
            status,
            agents (
              profiles:user_id (
                full_name
              )
            )
          `)
          .or(`tenant_name.ilike.%${debouncedSearchQuery}%,tenant_phone.ilike.%${debouncedSearchQuery}%`)
          .order("tenant_name", { ascending: true })
          .limit(8);

        if (error) throw error;

        setAutocompleteSuggestions(data || []);
        setShowAutocomplete((data || []).length > 0);
      } catch (error) {
        console.error("Error fetching autocomplete suggestions:", error);
      }
    };

    if (showTenantSearch) {
      fetchAutocompleteSuggestions();
    }
  }, [debouncedSearchQuery, showTenantSearch]);

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
        <ContentTransition
          loading={isLoading}
          skeleton={<ManagerDashboardSkeleton />}
        >
          <div className="space-y-6 animate-reveal">
            <div id="welcome-message">
              <h1 className="text-3xl font-bold">Manager Dashboard</h1>
              <p className="text-muted-foreground">Service Centre Overview</p>
            </div>

            {/* PROMINENT SEARCH HERO SECTION */}
            <Card className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 border-primary shadow-2xl">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                    <Search className="h-8 w-8" />
                    Quick Search
                  </h2>
                  <p className="text-white/90 text-lg">
                    Find any tenant or agent instantly
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  {/* Tenant Search */}
                  <button
                    onClick={() => {
                      setShowTenantSearch(true);
                      setSearchResults([]);
                      setTenantSearchQuery("");
                      setAutocompleteSuggestions([]);
                      setShowAutocomplete(false);
                      clearTenantFilters();
                      setShowAdvancedFilters(false);
                      haptics.light();
                    }}
                    className="group relative overflow-hidden bg-white hover:bg-white/95 text-foreground rounded-xl p-6 transition-all hover:scale-105 hover:shadow-xl"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <UserCheck className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl mb-1">Search Tenants</h3>
                        <p className="text-sm text-muted-foreground">
                          Find by name or phone number
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-primary font-semibold">
                        <span>Start Search</span>
                        <Search className="h-4 w-4" />
                      </div>
                    </div>
                    
                    {/* Decorative element */}
                    <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                  </button>

                  {/* Agent Search */}
                  <button
                    onClick={() => {
                      setShowAgentSearch(true);
                      setSearchResults([]);
                      setAgentSearchQuery("");
                      clearAgentFilters();
                      setShowAdvancedFilters(false);
                      haptics.light();
                    }}
                    className="group relative overflow-hidden bg-white hover:bg-white/95 text-foreground rounded-xl p-6 transition-all hover:scale-105 hover:shadow-xl"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                        <Users className="h-8 w-8 text-success" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl mb-1">Search Agents</h3>
                        <p className="text-sm text-muted-foreground">
                          Find by name or phone number
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-success font-semibold">
                        <span>Start Search</span>
                        <Search className="h-4 w-4" />
                      </div>
                    </div>
                    
                    {/* Decorative element */}
                    <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-success/5 group-hover:bg-success/10 transition-colors" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Payment Report Stats Card */}
            <Card 
              className="bg-gradient-to-br from-success/10 to-success/5 border-success/20 cursor-pointer hover:border-success/40 transition-all hover:shadow-xl"
              onClick={() => {
                // Reset to last 24 hours
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                setReportStartDate(yesterday);
                setReportEndDate(new Date());
                fetchPaymentReportData(yesterday, new Date());
                setPaymentReportOpen(true);
                haptics.light();
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-success" />
                  Total Rent Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  Last 24 Hours
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tap to view detailed breakdown
                </p>
              </CardContent>
            </Card>

          {/* Broadcast Messaging Feature */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card id="bulk-messaging" className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Broadcast Messages
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Send announcements and updates to all agents
                    </p>
                  </div>
                  <BulkMessageDialog sendToAll={true} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Daily Repayment Calculator
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Calculate customer payment plans
                    </p>
                  </div>
                  <Button 
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      setCalculatorOpen(true);
                      haptics.light();
                    }}
                  >
                    <Calculator className="h-5 w-5 mr-2" />
                    Calculate
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-success/10 to-success/5 border-success/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Record Payment
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Enter payments for any tenant
                    </p>
                  </div>
                  <Button 
                    size="lg"
                    className="bg-success hover:bg-success/90"
                    onClick={() => {
                      setPaymentDialogOpen(true);
                      haptics.light();
                    }}
                  >
                    <Wallet className="h-5 w-5 mr-2" />
                    Pay
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Batch Payments
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Record multiple payments at once
                    </p>
                  </div>
                  <Button 
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      setBatchPaymentDialogOpen(true);
                      haptics.light();
                    }}
                  >
                    <Save className="h-5 w-5 mr-2" />
                    Batch
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Commission Summaries
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Preview & send daily earnings to agents
                    </p>
                  </div>
                  <div className="ml-2">
                    <ManagerCommissionSummaryDialog />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DailyRepaymentCalculatorDialog
            open={calculatorOpen}
            onOpenChange={setCalculatorOpen}
          />

          <ManagerPaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
          />

          <BatchPaymentDialog
            open={batchPaymentDialogOpen}
            onOpenChange={setBatchPaymentDialogOpen}
          />

          {/* Payment Report Dialog */}
          <Dialog open={paymentReportOpen} onOpenChange={setPaymentReportOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-success" />
                  Payment Report - Rent Collection Breakdown
                </DialogTitle>
                <DialogDescription>
                  Detailed analysis of rent payments by day, week, and payment method
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Date Range Filters */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Select Date Range</h3>
                        <Badge variant="outline" className="text-xs">
                          {reportStartDate && reportEndDate && (
                            <>
                              {format(reportStartDate, 'MMM dd, yyyy')} - {format(reportEndDate, 'MMM dd, yyyy')}
                            </>
                          )}
                        </Badge>
                      </div>

                      {/* Quick Filter Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickFilter('last24h')}
                          className="text-xs"
                        >
                          Last 24 Hours
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickFilter('last7d')}
                          className="text-xs"
                        >
                          Last 7 Days
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickFilter('last30d')}
                          className="text-xs"
                        >
                          Last 30 Days
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickFilter('last90d')}
                          className="text-xs"
                        >
                          Last 90 Days
                        </Button>
                      </div>

                      {/* Custom Date Range Pickers */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !reportStartDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {reportStartDate ? format(reportStartDate, "PPP") : <span>Pick start date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={reportStartDate}
                                onSelect={setReportStartDate}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                                disabled={(date) => date > new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">End Date</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !reportEndDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {reportEndDate ? format(reportEndDate, "PPP") : <span>Pick end date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={reportEndDate}
                                onSelect={setReportEndDate}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                                disabled={(date) => date > new Date() || (reportStartDate ? date < reportStartDate : false)}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        onClick={() => {
                          setPaymentStatusFilter('all'); // Reset status filter
                          fetchPaymentReportData();
                          haptics.light();
                        }}
                        disabled={!reportStartDate || !reportEndDate}
                      >
                        Apply Custom Range
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Status Filter */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm">Filter by Status</h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={paymentStatusFilter === 'all' ? 'default' : 'outline'}
                          onClick={() => {
                            setPaymentStatusFilter('all');
                            haptics.light();
                          }}
                          className="text-xs"
                        >
                          All Payments
                          {paymentStatusFilter === 'all' && (
                            <Badge variant="secondary" className="ml-2">
                              {paymentReportData.dailyBreakdown.reduce((sum, day) => sum + day.payments.length, 0)}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant={paymentStatusFilter === 'verified' ? 'default' : 'outline'}
                          onClick={() => {
                            setPaymentStatusFilter('verified');
                            haptics.light();
                          }}
                          className="text-xs"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                          {paymentStatusFilter === 'verified' && (
                            <Badge variant="secondary" className="ml-2">
                              {paymentReportData.dailyBreakdown.reduce((sum, day) => 
                                sum + day.payments.filter((p: any) => p.status === 'verified').length, 0)}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant={paymentStatusFilter === 'pending' ? 'default' : 'outline'}
                          onClick={() => {
                            setPaymentStatusFilter('pending');
                            haptics.light();
                          }}
                          className="text-xs"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                          {paymentStatusFilter === 'pending' && (
                            <Badge variant="secondary" className="ml-2">
                              {paymentReportData.dailyBreakdown.reduce((sum, day) => 
                                sum + day.payments.filter((p: any) => p.status === 'pending').length, 0)}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant={paymentStatusFilter === 'rejected' ? 'default' : 'outline'}
                          onClick={() => {
                            setPaymentStatusFilter('rejected');
                            haptics.light();
                          }}
                          className="text-xs"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejected
                          {paymentStatusFilter === 'rejected' && (
                            <Badge variant="secondary" className="ml-2">
                              {paymentReportData.dailyBreakdown.reduce((sum, day) => 
                                sum + day.payments.filter((p: any) => p.status === 'rejected').length, 0)}
                            </Badge>
                          )}
                        </Button>
                      </div>
                      {paymentStatusFilter !== 'all' && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background p-2 rounded border">
                          <AlertCircle className="h-3 w-3" />
                          <span>Showing only {paymentStatusFilter} payments</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                {/* Total Summary */}
                <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Total Rent Collected
                        {reportStartDate && reportEndDate && (
                          <span className="block text-xs mt-1">
                            ({format(reportStartDate, 'MMM dd, yyyy')} - {format(reportEndDate, 'MMM dd, yyyy')})
                          </span>
                        )}
                      </p>
                      <p className="text-4xl font-bold text-success">
                        UGX {getFilteredPaymentData().totalRent.toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Manager Verification Leaderboard */}
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-purple-600" />
                      Manager Verification Leaderboard
                    </CardTitle>
                    <CardDescription>Top managers by verification volume for selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {getFilteredPaymentData().managerLeaderboard.length > 0 ? (
                      <div className="space-y-3">
                        {getFilteredPaymentData().managerLeaderboard.map((manager, index) => (
                          <div 
                            key={manager.managerId}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-lg border transition-all",
                              index === 0 && "bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 border-yellow-500/30",
                              index === 1 && "bg-gradient-to-r from-gray-400/10 to-gray-500/5 border-gray-400/30",
                              index === 2 && "bg-gradient-to-r from-orange-600/10 to-orange-700/5 border-orange-600/30",
                              index > 2 && "bg-muted/30 border-border"
                            )}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg",
                                index === 0 && "bg-yellow-500 text-white",
                                index === 1 && "bg-gray-400 text-white",
                                index === 2 && "bg-orange-600 text-white",
                                index > 2 && "bg-muted text-muted-foreground"
                              )}>
                                {index === 0 && "🥇"}
                                {index === 1 && "🥈"}
                                {index === 2 && "🥉"}
                                {index > 2 && `#${index + 1}`}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-sm">{manager.managerName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {manager.verificationCount} payment{manager.verificationCount !== 1 ? 's' : ''} verified
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg text-success">
                                UGX {manager.totalAmount.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {((manager.totalAmount / paymentReportData.totalRent) * 100).toFixed(1)}% of total
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No verifications in selected period</p>
                      </div>
                    )}

                    {/* Summary Stats */}
                    {getFilteredPaymentData().managerLeaderboard.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-border">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Active Managers</p>
                            <p className="text-2xl font-bold text-primary">
                              {getFilteredPaymentData().managerLeaderboard.length}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Avg per Manager</p>
                            <p className="text-2xl font-bold text-primary">
                              {getFilteredPaymentData().managerLeaderboard.length > 0 
                                ? (getFilteredPaymentData().totalRent / getFilteredPaymentData().managerLeaderboard.length).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                : '0'
                              }
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Top Manager</p>
                            <p className="text-2xl font-bold text-primary">
                              {getFilteredPaymentData().managerLeaderboard.length > 0 
                                ? ((getFilteredPaymentData().managerLeaderboard[0].totalAmount / getFilteredPaymentData().totalRent) * 100).toFixed(0)
                                : '0'
                              }%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment Method Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment Method Breakdown</CardTitle>
                    <CardDescription>Distribution across payment channels</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        amount: {
                          label: "Amount (UGX)",
                          color: "hsl(var(--success))",
                        },
                      }}
                      className="h-[250px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getFilteredPaymentData().paymentMethodBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="method" 
                            className="text-xs"
                          />
                          <YAxis 
                            className="text-xs"
                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                          />
                          <Tooltip 
                            content={<ChartTooltipContent />}
                            formatter={(value: any) => [`UGX ${value.toLocaleString()}`, "Amount"]}
                          />
                          <Bar 
                            dataKey="amount" 
                            fill="hsl(var(--success))" 
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      {getFilteredPaymentData().paymentMethodBreakdown.map((item) => (
                        <div key={item.method} className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">{item.method}</p>
                          <p className="text-lg font-bold">UGX {item.amount.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Daily Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Daily Collection Trend</CardTitle>
                    <CardDescription>Day-by-day breakdown for selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        amount: {
                          label: "Amount (UGX)",
                          color: "hsl(var(--primary))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getFilteredPaymentData().dailyBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            className="text-xs"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            className="text-xs"
                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                          />
                          <Tooltip 
                            content={<ChartTooltipContent />}
                            formatter={(value: any) => [`UGX ${value.toLocaleString()}`, "Amount"]}
                          />
                          <Bar 
                            dataKey="amount" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>

                    {/* Detailed Payment Breakdown by Day */}
                    <div className="mt-6 space-y-4">
                      <h4 className="font-semibold text-sm">All Payments by Day</h4>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {getFilteredPaymentData().dailyBreakdown.filter(day => day.payments && day.payments.length > 0).map((day, idx) => (
                          <div key={idx} className="border rounded-lg p-4 bg-muted/30">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="font-semibold text-sm">{day.date}</p>
                                <p className="text-xs text-muted-foreground">{day.payments.length} payment{day.payments.length !== 1 ? 's' : ''}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                UGX {day.amount.toLocaleString()}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {day.payments.map((payment: any, pIdx: number) => (
                                <div key={pIdx} className="flex items-start justify-between text-xs p-2 bg-background rounded border">
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium">{payment.tenantName}</span>
                                      <Badge variant="secondary" className="text-xs">
                                        {payment.paymentMethod?.toUpperCase() || 'CASH'}
                                      </Badge>
                                      <Badge 
                                        variant={
                                          payment.status === 'verified' ? 'default' : 
                                          payment.status === 'rejected' ? 'destructive' : 
                                          'outline'
                                        }
                                        className="text-xs"
                                      >
                                        {payment.status === 'verified' ? '✓ Verified' : 
                                         payment.status === 'rejected' ? '✗ Rejected' : 
                                         '⏱ Pending'}
                                      </Badge>
                                    </div>
                                    <p className="text-muted-foreground">Agent: {payment.agentName}</p>
                                    {payment.status === 'verified' && (
                                      <>
                                        <p className="text-success font-medium">Verified by: {payment.managerName}</p>
                                        {payment.verifiedAt && (
                                          <p className="text-muted-foreground">
                                            {format(new Date(payment.verifiedAt), 'MMM dd, yyyy HH:mm')}
                                          </p>
                                        )}
                                      </>
                                    )}
                                    {payment.status === 'pending' && (
                                      <p className="text-warning font-medium">⏱ Awaiting verification</p>
                                    )}
                                    {payment.status === 'rejected' && (
                                      <p className="text-destructive font-medium">✗ Rejected by manager</p>
                                    )}
                                  </div>
                                  <div className="font-bold text-right">
                                    UGX {payment.amount.toLocaleString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Weekly Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Weekly Collection Trend</CardTitle>
                    <CardDescription>Week-by-week breakdown for selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        amount: {
                          label: "Amount (UGX)",
                          color: "hsl(var(--chart-2))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getFilteredPaymentData().weeklyBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="week" 
                            className="text-xs"
                            angle={-15}
                            textAnchor="end"
                            height={100}
                          />
                          <YAxis 
                            className="text-xs"
                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                          />
                          <Tooltip 
                            content={<ChartTooltipContent />}
                            formatter={(value: any) => [`UGX ${value.toLocaleString()}`, "Amount"]}
                          />
                          <Bar 
                            dataKey="amount" 
                            fill="hsl(var(--chart-2))" 
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card id="stats-total-agents" className="cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate("/manager/agents")}>
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

          <Card 
            id="stats-active-tenants" 
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
            onClick={() => {
              haptics.light();
              navigate("/manager/portfolio-breakdown?filter=active");
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                💰 Active Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.activeTenants}</div>
              <p className="text-xs text-success mt-1">With outstanding balances</p>
            </CardContent>
          </Card>

          <Card 
            id="stats-pipeline-tenants"
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
            onClick={() => {
              haptics.light();
              navigate("/manager/portfolio-breakdown?filter=pipeline");
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-500" />
                📋 Pipeline Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{stats.pipelineTenants}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered, no balance</p>
            </CardContent>
          </Card>

          <Card 
            id="stats-overdue-tenants"
            className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
            onClick={() => {
              haptics.light();
              navigate("/manager/portfolio-breakdown?filter=overdue");
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                ⚠️ Overdue Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.overdueTenants}</div>
              <p className="text-xs text-muted-foreground mt-1">Need immediate attention</p>
            </CardContent>
          </Card>

          <Card
            id="stats-total-landlords"
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => fetchLandlordAgentBreakdown()}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                Total Landlords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.totalLandlords}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Click to view by agent
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all hover:scale-105"
            onClick={() => navigate("/manager/password-requests")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Password Change Requests</p>
                  <p className="text-3xl font-bold">{stats.pendingPasswordRequests}</p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-full">
                  <KeyRound className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            id="stats-total-tenants-registered"
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => fetchTenantAgentBreakdown()}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-500" />
                Tenants Registered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{stats.totalTenantsRegistered}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Click to view by agent
              </p>
            </CardContent>
          </Card>

          <Card id="stats-pending-verifications" className="cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate("/manager/verifications")}>
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
            id="stats-portfolio-value"
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

          <Card 
            className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 cursor-pointer hover:border-green-500/40 transition-all hover:shadow-lg"
            onClick={() => {
              haptics.light();
              navigate("/manager/payment-verifications");
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Total Verified Commissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                UGX {stats.totalVerifiedCommission.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Applied on {stats.verifiedPayments} verified payment{stats.verifiedPayments !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Commission Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Commission Breakdown by Payment Method */}
          <Card className="border-green-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Commission Breakdown by Payment Method
              </CardTitle>
              <CardDescription>
                Total verified commissions earned across all payment methods
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commissionByMethod.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No commission data available yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {commissionByMethod.map((item, index) => (
                    <div key={item.method} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${
                            item.method === 'Cash' ? 'bg-blue-500' :
                            item.method === 'MTN Mobile Money' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                          <span className="font-medium text-sm">{item.method}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-700">
                            UGX {item.commission.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all ${
                            item.method === 'Cash' ? 'bg-blue-500' :
                            item.method === 'MTN Mobile Money' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {/* Summary */}
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">Total Commission (All Methods)</span>
                      <span className="font-bold text-green-700 text-lg">
                        UGX {stats.totalVerifiedCommission.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Agents by Commission Leaderboard */}
          <Card className="border-amber-500/20">
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Top Agents by Commission
                  </CardTitle>
                  <CardDescription>
                    Highest earning agents from verified payments
                  </CardDescription>
                </div>
              </div>
              
              {/* Time Period Filter Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant={commissionTimePeriod === '7d' ? 'default' : 'outline'}
                  onClick={() => {
                    setCommissionTimePeriod('7d');
                    fetchTopAgentsByCommission('7d');
                    haptics.light();
                  }}
                  className="text-xs"
                >
                  Last 7 Days
                </Button>
                <Button
                  size="sm"
                  variant={commissionTimePeriod === '30d' ? 'default' : 'outline'}
                  onClick={() => {
                    setCommissionTimePeriod('30d');
                    fetchTopAgentsByCommission('30d');
                    haptics.light();
                  }}
                  className="text-xs"
                >
                  Last 30 Days
                </Button>
                <Button
                  size="sm"
                  variant={commissionTimePeriod === 'all' ? 'default' : 'outline'}
                  onClick={() => {
                    setCommissionTimePeriod('all');
                    fetchTopAgentsByCommission('all');
                    haptics.light();
                  }}
                  className="text-xs"
                >
                  All Time
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {topAgentsByCommission.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No commission data available for this period</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topAgentsByCommission.map((agent, index) => (
                    <div
                      key={agent.agentId}
                      className="p-4 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer hover:border-amber-500/50"
                      onClick={() => {
                        haptics.light();
                        navigate(`/manager/agents/${agent.agentId}`);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            index === 0 ? 'bg-amber-500 text-white' :
                            index === 1 ? 'bg-gray-400 text-white' :
                            index === 2 ? 'bg-amber-700 text-white' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{agent.agentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {agent.paymentCount} payment{agent.paymentCount !== 1 ? 's' : ''} • {agent.tenantCount} tenant{agent.tenantCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-700 text-base">
                            UGX {agent.totalCommission.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                              Efficiency: UGX {agent.efficiencyScore.toLocaleString(undefined, { maximumFractionDigits: 0 })}/tenant
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Avg: UGX {agent.averageCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })} per payment
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <div className={`h-2 w-2 rounded-full ${
                              agent.preferredMethod === 'Cash' ? 'bg-blue-500' :
                              agent.preferredMethod === 'MTN Mobile Money' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`} />
                            <p className="text-xs text-muted-foreground">
                              {agent.preferredMethod}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comprehensive Agent Earnings Breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-success" />
                    Agent Earnings Breakdown
                  </CardTitle>
                  <CardDescription>
                    Complete financial overview for all agents
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/manager/agents")}
                >
                  View All Agents →
                </Button>
              </div>
              
              {/* Filter Controls */}
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={earningsFilterType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setEarningsFilterType('all');
                      haptics.light();
                    }}
                  >
                    All Agents
                  </Button>
                  <Button
                    variant={earningsFilterType === 'top' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setEarningsFilterType('top');
                      haptics.light();
                    }}
                    className="bg-success/10 hover:bg-success/20 border-success/30"
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Top Earners
                  </Button>
                  <Button
                    variant={earningsFilterType === 'low' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setEarningsFilterType('low');
                      haptics.light();
                    }}
                    className="bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30"
                  >
                    <Target className="h-3 w-3 mr-1" />
                    Low Performers
                  </Button>
                  <Button
                    variant={earningsFilterType === 'range' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setEarningsFilterType('range');
                      haptics.light();
                    }}
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    Custom Range
                  </Button>
                </div>

                {/* Earning Range Inputs */}
                {earningsFilterType === 'range' && (
                  <div className="flex flex-wrap gap-3 items-center p-3 bg-muted/50 rounded-lg border">
                    <div className="flex-1 min-w-[140px]">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Min Earnings (UGX)
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={minEarningsFilter}
                        onChange={(e) => setMinEarningsFilter(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Max Earnings (UGX)
                      </label>
                      <Input
                        type="number"
                        placeholder="No limit"
                        value={maxEarningsFilter}
                        onChange={(e) => setMaxEarningsFilter(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMinEarningsFilter("");
                        setMaxEarningsFilter("");
                        haptics.light();
                      }}
                      className="h-8 mt-5"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                )}

                {/* Filter Summary */}
                {earningsFilterType !== 'all' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">
                      Showing: {getFilteredAgentsByEarnings().length} agent{getFilteredAgentsByEarnings().length !== 1 ? 's' : ''}
                    </span>
                    {earningsFilterType === 'top' && <span>• Top 30% by commission earned</span>}
                    {earningsFilterType === 'low' && <span>• Bottom 30% by commission earned</span>}
                    {earningsFilterType === 'range' && (
                      <span>
                        • Range: UGX {minEarningsFilter || '0'} - {maxEarningsFilter || '∞'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <SkeletonWrapper 
                loading={isLoading}
                skeleton={
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Skeleton className="h-16 w-full" />
                          <Skeleton className="h-16 w-full" />
                          <Skeleton className="h-16 w-full" />
                          <Skeleton className="h-16 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                }
              >
                {getFilteredAgentsByEarnings().length > 0 ? (
                  <div className="space-y-4">
                    {getFilteredAgentsByEarnings().map((agent, index) => (
                      <div
                        key={agent.agentId}
                        className="p-4 border-2 rounded-lg hover:border-primary/40 transition-all cursor-pointer"
                        onClick={() => {
                          navigate(`/manager/agents/${agent.agentId}`);
                          haptics.light();
                        }}
                      >
                        {/* Agent Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-success/10 font-bold text-success">
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">
                              {agent.agentName}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {agent.tenantCount} tenants · {agent.paymentCount} verified payments
                            </p>
                          </div>
                          {index === 0 && (
                            <Badge variant="default" className="bg-success text-white">
                              🏆 Top Earner
                            </Badge>
                          )}
                        </div>

                        {/* Earnings Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {/* Total Commission */}
                          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingUp className="h-4 w-4 text-success" />
                              <p className="text-xs text-muted-foreground font-medium">Commission Earned</p>
                            </div>
                            <p className="text-xl font-bold text-success">
                              UGX {agent.totalCommission.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Avg: UGX {agent.averageCommission.toLocaleString()} per payment
                            </p>
                          </div>

                          {/* Wallet Balance */}
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex items-center gap-2 mb-1">
                              <Wallet className="h-4 w-4 text-primary" />
                              <p className="text-xs text-muted-foreground font-medium">Wallet Balance</p>
                            </div>
                            <p className="text-xl font-bold text-primary">
                              UGX {(agent.walletBalance || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Available for withdrawal
                            </p>
                          </div>

                          {/* Total Earnings (Commission) */}
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="h-4 w-4 text-amber-600" />
                              <p className="text-xs text-muted-foreground font-medium">Monthly Earnings</p>
                            </div>
                            <p className="text-xl font-bold text-amber-600">
                              UGX {(agent.monthlyEarnings || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              This billing cycle
                            </p>
                          </div>

                          {/* Preferred Payment Method */}
                          <div className="p-3 rounded-lg bg-muted border">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`h-3 w-3 rounded-full ${
                                agent.preferredMethod === 'Cash' ? 'bg-blue-500' :
                                agent.preferredMethod === 'MTN Mobile Money' ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`} />
                              <p className="text-xs text-muted-foreground font-medium">Preferred Method</p>
                            </div>
                            <p className="text-lg font-bold">
                              {agent.preferredMethod}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Most used channel
                            </p>
                          </div>
                        </div>

                        {/* Quick Stats Bar */}
                        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                          <span>Portfolio: UGX {(agent.portfolioValue || 0).toLocaleString()}</span>
                          <span>Collection Rate: {(agent.collectionRate || 0).toFixed(1)}%</span>
                          <span className="text-success font-medium">
                            Total Commission: UGX {agent.totalCommission.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Coins className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    {earningsFilterType === 'all' ? (
                      <>
                        <p>No earnings data available yet</p>
                        <p className="text-xs mt-1">Agents will appear here once they start earning commissions</p>
                      </>
                    ) : (
                      <>
                        <p>No agents match the selected filter</p>
                        <p className="text-xs mt-1">
                          {earningsFilterType === 'top' && 'No top earners found with current criteria'}
                          {earningsFilterType === 'low' && 'No low performers found with current criteria'}
                          {earningsFilterType === 'range' && 'No agents fall within the specified earning range'}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setEarningsFilterType('all');
                            setMinEarningsFilter("");
                            setMaxEarningsFilter("");
                            haptics.light();
                          }}
                        >
                          Clear Filters
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </SkeletonWrapper>
            </CardContent>
          </Card>
        </div>

        {/* Live Activity Feed */}
        <div id="activity-feed">
          <ActivityFeed maxItems={20} className="lg:col-span-2" />
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

          {/* TID History Quick Access */}
          <Card className="border-2 border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-colors" onClick={() => navigate("/manager/tid-history")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-purple-500" />
                Transaction ID (TID) History
              </CardTitle>
              <CardDescription>
                Complete audit trail of all payment transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-purple-500/20">
                    <Hash className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">View Complete History</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Track all TIDs with timestamps and recorders
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  View Details →
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* TID Validation Quick Access */}
          <Card className="border-2 border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-colors" onClick={() => navigate("/manager/tid-validation")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                TID Validation & Audit
              </CardTitle>
              <CardDescription>
                Fix legacy TIDs and validate format compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-amber-500/20">
                    <Shield className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Audit Legacy TIDs</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Identify and fix placeholder Transaction IDs
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  Validate →
                </Button>
              </div>
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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Payment Method Breakdown
                  </CardTitle>
                  <CardDescription>
                    Collections by payment method across all agents (
                    {paymentMethodTimePeriod === '7d' ? 'Last 7 days' :
                     paymentMethodTimePeriod === '30d' ? 'Last 30 days' :
                     paymentMethodTimePeriod === '90d' ? 'Last 90 days' :
                     paymentMethodTimePeriod === 'custom' && paymentMethodCustomStartDate && paymentMethodCustomEndDate
                       ? `${format(paymentMethodCustomStartDate, 'MMM dd, yyyy')} - ${format(paymentMethodCustomEndDate, 'MMM dd, yyyy')}`
                       : 'All time'})
                  </CardDescription>
                  
                  {/* Custom Date Range Badge */}
                  {paymentMethodTimePeriod === 'custom' && paymentMethodCustomStartDate && paymentMethodCustomEndDate && (
                    <div className="flex items-center gap-2 mt-3">
                      <Badge 
                        variant="secondary" 
                        className="bg-primary/10 text-primary border-primary/20 flex items-center gap-2 px-3 py-1.5"
                      >
                        <CalendarIcon className="h-3 w-3" />
                        <span className="text-xs font-medium">
                          Custom Range: {format(paymentMethodCustomStartDate, 'MMM dd')} - {format(paymentMethodCustomEndDate, 'MMM dd, yyyy')}
                          {' '}({Math.ceil((paymentMethodCustomEndDate.getTime() - paymentMethodCustomStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                        </span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setPaymentMethodTimePeriod('30d');
                            setPaymentMethodCustomStartDate(undefined);
                            setPaymentMethodCustomEndDate(undefined);
                            await fetchPaymentMethodBreakdown('30d');
                            const { data: agents } = await supabase.from("agents").select("*");
                            if (agents) await fetchAgentPaymentMethodBreakdown(agents, '30d');
                            haptics.light();
                            toast.success('Returned to 30-day view');
                          }}
                          className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Export Buttons */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportPaymentMethodCSV}
                    className="text-xs"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportPaymentMethodPDF}
                    className="text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    PDF
                  </Button>
                  
                  {/* Time Period Filters */}
                  <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={paymentMethodTimePeriod === '7d' ? 'default' : 'outline'}
                    onClick={async () => {
                      setPaymentMethodTimePeriod('7d');
                      await fetchPaymentMethodBreakdown('7d');
                      const { data: agents } = await supabase.from("agents").select("*");
                      if (agents) await fetchAgentPaymentMethodBreakdown(agents, '7d');
                      haptics.light();
                    }}
                    className="text-xs"
                  >
                    7 Days
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentMethodTimePeriod === '30d' ? 'default' : 'outline'}
                    onClick={async () => {
                      setPaymentMethodTimePeriod('30d');
                      await fetchPaymentMethodBreakdown('30d');
                      const { data: agents } = await supabase.from("agents").select("*");
                      if (agents) await fetchAgentPaymentMethodBreakdown(agents, '30d');
                      haptics.light();
                    }}
                    className="text-xs"
                  >
                    30 Days
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentMethodTimePeriod === '90d' ? 'default' : 'outline'}
                    onClick={async () => {
                      setPaymentMethodTimePeriod('90d');
                      await fetchPaymentMethodBreakdown('90d');
                      const { data: agents } = await supabase.from("agents").select("*");
                      if (agents) await fetchAgentPaymentMethodBreakdown(agents, '90d');
                      haptics.light();
                    }}
                    className="text-xs"
                  >
                    90 Days
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentMethodTimePeriod === 'all' ? 'default' : 'outline'}
                    onClick={async () => {
                      setPaymentMethodTimePeriod('all');
                      await fetchPaymentMethodBreakdown('all');
                      const { data: agents } = await supabase.from("agents").select("*");
                      if (agents) await fetchAgentPaymentMethodBreakdown(agents, 'all');
                      haptics.light();
                    }}
                    className="text-xs"
                  >
                    All Time
                  </Button>
                  
                  {/* Custom Date Range Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant={paymentMethodTimePeriod === 'custom' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        Custom
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <div className="p-4 space-y-4">
                        {/* Quick Presets */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Quick Presets</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const now = new Date();
                                const startOfWeek = new Date(now);
                                startOfWeek.setDate(now.getDate() - now.getDay());
                                const endOfWeek = new Date(now);
                                setPaymentMethodCustomStartDate(startOfWeek);
                                setPaymentMethodCustomEndDate(endOfWeek);
                                haptics.light();
                              }}
                              className="text-xs"
                            >
                              This Week
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const now = new Date();
                                const startOfLastWeek = new Date(now);
                                startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
                                const endOfLastWeek = new Date(now);
                                endOfLastWeek.setDate(now.getDate() - now.getDay() - 1);
                                setPaymentMethodCustomStartDate(startOfLastWeek);
                                setPaymentMethodCustomEndDate(endOfLastWeek);
                                haptics.light();
                              }}
                              className="text-xs"
                            >
                              Last Week
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const now = new Date();
                                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                                const endOfMonth = new Date(now);
                                setPaymentMethodCustomStartDate(startOfMonth);
                                setPaymentMethodCustomEndDate(endOfMonth);
                                haptics.light();
                              }}
                              className="text-xs"
                            >
                              This Month
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const now = new Date();
                                const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                                setPaymentMethodCustomStartDate(startOfLastMonth);
                                setPaymentMethodCustomEndDate(endOfLastMonth);
                                haptics.light();
                              }}
                              className="text-xs"
                            >
                              Last Month
                            </Button>
                          </div>
                        </div>
                        
                        <div className="border-t pt-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Start Date</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !paymentMethodCustomStartDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {paymentMethodCustomStartDate ? format(paymentMethodCustomStartDate, "PPP") : "Pick start date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={paymentMethodCustomStartDate}
                                onSelect={setPaymentMethodCustomStartDate}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">End Date</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !paymentMethodCustomEndDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {paymentMethodCustomEndDate ? format(paymentMethodCustomEndDate, "PPP") : "Pick end date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={paymentMethodCustomEndDate}
                                onSelect={setPaymentMethodCustomEndDate}
                                disabled={(date) => 
                                  paymentMethodCustomStartDate ? date < paymentMethodCustomStartDate : false
                                }
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        </div>
                        
                        <Button
                          className="w-full"
                          onClick={async () => {
                            if (!paymentMethodCustomStartDate || !paymentMethodCustomEndDate) {
                              toast.error('Please select both start and end dates');
                              return;
                            }
                            setPaymentMethodTimePeriod('custom');
                            await fetchPaymentMethodBreakdown('custom', paymentMethodCustomStartDate, paymentMethodCustomEndDate);
                            const { data: agents } = await supabase.from("agents").select("*");
                            if (agents) await fetchAgentPaymentMethodBreakdown(agents, paymentMethodTimePeriod, paymentMethodCustomStartDate, paymentMethodCustomEndDate);
                            haptics.light();
                            toast.success('Custom date range applied');
                          }}
                          disabled={!paymentMethodCustomStartDate || !paymentMethodCustomEndDate}
                        >
                          Apply Date Range
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  </div>
                </div>
              </div>
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
                      vs. previous {
                        paymentMethodTimePeriod === '7d' ? '7 days' :
                        paymentMethodTimePeriod === '30d' ? '30 days' :
                        paymentMethodTimePeriod === '90d' ? '90 days' :
                        paymentMethodTimePeriod === 'custom' ? 'period' :
                        '90 days'
                      }
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
                Compare payment method usage across top agents (
                {paymentMethodTimePeriod === '7d' ? 'Last 7 days' :
                 paymentMethodTimePeriod === '30d' ? 'Last 30 days' :
                 paymentMethodTimePeriod === '90d' ? 'Last 90 days' :
                 'All time'})
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

          {/* Payment Broadcast Widget */}
          <div id="payment-broadcast">
            <PaymentBroadcastWidget />
          </div>

          {/* Agents Quick List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Your Agents
                  </CardTitle>
                  <CardDescription>
                    Quick access to agent profiles and tenants
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/manager/agents")}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <SkeletonWrapper 
                loading={isLoading}
                skeleton={
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-9 w-24" />
                      </div>
                    ))}
                  </div>
                }
              >
                <AgentsList 
                  onPaymentClick={() => {
                    setPaymentDialogOpen(true);
                    haptics.light();
                  }}
                />
              </SkeletonWrapper>
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
        </ContentTransition>
      </PullToRefresh>

      {/* Tenant Search Dialog */}
      <Dialog 
        open={showTenantSearch} 
        onOpenChange={(open) => {
          setShowTenantSearch(open);
          if (!open) {
            setShowAutocomplete(false);
            setAutocompleteSuggestions([]);
            setTenantSearchQuery("");
            setSearchResults([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Tenants</DialogTitle>
            <DialogDescription>
              Start typing tenant name or phone to see instant suggestions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Start typing tenant name or phone number..."
                    value={tenantSearchQuery}
                    onChange={(e) => {
                      setTenantSearchQuery(e.target.value);
                      setSearchResults([]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTenantSearch();
                        setShowAutocomplete(false);
                      }
                      if (e.key === 'Escape') {
                        setShowAutocomplete(false);
                      }
                    }}
                    onFocus={() => {
                      if (autocompleteSuggestions.length > 0) {
                        setShowAutocomplete(true);
                      }
                    }}
                    className="flex-1"
                  />
                  
                  {/* Autocomplete Dropdown */}
                  {showAutocomplete && autocompleteSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                      <div className="p-2">
                        <p className="text-xs text-muted-foreground px-2 py-1 mb-1">
                          Suggestions ({autocompleteSuggestions.length})
                        </p>
                        {autocompleteSuggestions.map((tenant) => (
                          <div
                            key={tenant.id}
                            className="flex items-center justify-between p-3 rounded-md hover:bg-muted cursor-pointer transition-colors"
                            onClick={() => {
                              haptics.light();
                              navigate(`/manager/tenants/${tenant.id}`);
                              setShowTenantSearch(false);
                              setShowAutocomplete(false);
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate">
                                  {highlightMatch(tenant.tenant_name, tenantSearchQuery)}
                                </p>
                                <Badge 
                                  variant={tenant.status === 'verified' ? 'default' : 'secondary'}
                                  className="text-xs shrink-0"
                                >
                                  {tenant.status || 'pending'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {highlightMatch(tenant.tenant_phone, tenantSearchQuery)} • Agent: <span 
                                  className="cursor-pointer hover:text-primary hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/manager/agents/${tenant.agents?.id}`);
                                    setShowTenantSearch(false);
                                    setShowAutocomplete(false);
                                  }}
                                >
                                  {tenant.agents?.profiles?.full_name || 'Unknown'}
                                </span>
                              </p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-sm font-semibold">
                                UGX {Number(tenant.outstanding_balance || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button onClick={handleTenantSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  {tenantSearchQuery.trim() ? "Search" : "Browse All"}
                </Button>
              </div>
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
                <h3 className="font-medium text-sm text-muted-foreground">
                  Search Results ({searchResults.length})
                  {tenantSearchQuery.trim() && (
                    <span className="ml-2 text-primary">for "{tenantSearchQuery}"</span>
                  )}
                </h3>
                {searchResults.map((tenant: any) => (
                  <Card 
                    key={tenant.id}
                    className="cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all"
                    onClick={() => {
                      haptics.light();
                      navigate(`/manager/tenants/${tenant.id}`);
                      setShowTenantSearch(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg text-primary hover:underline">
                            {tenant.tenant_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">{tenant.tenant_phone}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              Agent: <span 
                                className="cursor-pointer hover:text-primary hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/manager/agents/${tenant.agents?.id}`);
                                  setShowTenantSearch(false);
                                }}
                              >
                                {tenant.agents?.profiles?.full_name || 'Unknown'}
                              </span>
                            </p>
                            <Badge variant={tenant.status === 'verified' ? 'default' : 'secondary'} className="text-xs">
                              {tenant.status || 'pending'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">UGX {Number(tenant.outstanding_balance || 0).toLocaleString()}</p>
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

      {/* Landlord Agent Breakdown Dialog */}
      <Dialog open={landlordBreakdownOpen} onOpenChange={setLandlordBreakdownOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Landlord Registrations by Agent
            </DialogTitle>
            <DialogDescription>
              Breakdown of {stats.totalLandlords} landlords registered by each agent
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Sorting Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sort by:</span>
              <Button
                size="sm"
                variant={landlordSortBy === 'count' ? 'default' : 'outline'}
                onClick={() => setLandlordSortBy('count')}
              >
                Count
              </Button>
              <Button
                size="sm"
                variant={landlordSortBy === 'name' ? 'default' : 'outline'}
                onClick={() => setLandlordSortBy('name')}
              >
                Agent Name
              </Button>
            </div>

            {/* Agent Breakdown */}
            {landlordAgentData
              .sort((a, b) => {
                if (landlordSortBy === 'count') {
                  return b.count - a.count;
                } else {
                  return a.agentName.localeCompare(b.agentName);
                }
              })
              .map((agent) => (
                <Card key={agent.agentId} className="hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                     <div className="flex items-center justify-between">
                      <div 
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/manager/agents/${agent.agentId}`);
                          setLandlordBreakdownOpen(false);
                        }}
                      >
                        <CardTitle className="text-lg text-primary hover:underline">{agent.agentName}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {agent.count} landlord{agent.count !== 1 ? 's' : ''} registered
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xl px-4 py-2">
                        {agent.count}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {agent.landlords.map((landlord: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            navigate(`/manager/landlord/${landlord.id}`);
                            setLandlordBreakdownOpen(false);
                          }}
                        >
                          <span className="font-medium text-sm text-primary hover:underline">{landlord.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(landlord.registeredAt), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

            {landlordAgentData.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No landlord registrations yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tenant Agent Breakdown Dialog */}
      <Dialog open={tenantBreakdownOpen} onOpenChange={setTenantBreakdownOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-500" />
              Tenant Registrations by Agent
            </DialogTitle>
            <DialogDescription>
              Breakdown of {stats.totalTenantsRegistered} tenants registered by each agent
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Sorting Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sort by:</span>
              <Button
                size="sm"
                variant={tenantSortBy === 'count' ? 'default' : 'outline'}
                onClick={() => setTenantSortBy('count')}
              >
                Count
              </Button>
              <Button
                size="sm"
                variant={tenantSortBy === 'name' ? 'default' : 'outline'}
                onClick={() => setTenantSortBy('name')}
              >
                Agent Name
              </Button>
            </div>

            {/* Agent Breakdown */}
            {tenantAgentData
              .sort((a, b) => {
                if (tenantSortBy === 'count') {
                  return b.count - a.count;
                } else {
                  return a.agentName.localeCompare(b.agentName);
                }
              })
              .map((agent) => (
                <Card key={agent.agentId} className="hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div 
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/manager/agents/${agent.agentId}`);
                          setTenantBreakdownOpen(false);
                        }}
                      >
                        <CardTitle className="text-lg text-primary hover:underline">{agent.agentName}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {agent.count} tenant{agent.count !== 1 ? 's' : ''} registered
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xl px-4 py-2">
                        {agent.count}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {agent.tenants.map((tenant: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            navigate(`/manager/tenant/${tenant.id}`);
                            setTenantBreakdownOpen(false);
                          }}
                        >
                          <span className="font-medium text-sm text-primary hover:underline">{tenant.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(tenant.registeredAt), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

            {tenantAgentData.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No tenant registrations yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ManagerLayout>
  );
};

export default ManagerDashboard;

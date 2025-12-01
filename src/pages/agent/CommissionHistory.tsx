import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  Clock, 
  User, 
  CalendarIcon, 
  Search, 
  TrendingUp,
  FileText,
  CheckCircle2,
  X,
  Receipt
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CommissionDeposit {
  id: string;
  amount: number;
  commission: number;
  verified_at: string;
  payment_id: string | null;
  payment_method: string | null;
  collection_date: string;
  tenant: {
    id: string;
    tenant_name: string;
    tenant_phone: string;
  };
  verified_by_profile: {
    full_name: string | null;
  } | null;
}

type DateRangePreset = "all" | "today" | "week" | "month" | "custom";

export default function CommissionHistory() {
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<CommissionDeposit[]>([]);
  const [filteredDeposits, setFilteredDeposits] = useState<CommissionDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("month");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [totalCommission, setTotalCommission] = useState(0);
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    fetchCommissionHistory();
  }, []);

  useEffect(() => {
    filterDeposits();
  }, [deposits, searchQuery, datePreset, customDateRange]);

  const fetchCommissionHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get agent ID
      const { data: agentData } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agentData) return;
      setAgentId(agentData.id);

      // Fetch all verified payments (commission deposits)
      const { data, error } = await supabase
        .from("collections")
        .select(`
          id,
          amount,
          commission,
          verified_at,
          payment_id,
          payment_method,
          collection_date,
          tenant:tenants (
            id,
            tenant_name,
            tenant_phone
          ),
          verified_by_profile:profiles!collections_verified_by_fkey (
            full_name
          )
        `)
        .eq("agent_id", agentData.id)
        .eq("status", "verified")
        .not("verified_at", "is", null)
        .order("verified_at", { ascending: false });

      if (error) throw error;

      setDeposits((data || []) as unknown as CommissionDeposit[]);
      setFilteredDeposits((data || []) as unknown as CommissionDeposit[]);

      // Calculate total commission
      const total = (data || []).reduce((sum, d) => sum + d.commission, 0);
      setTotalCommission(total);
    } catch (error: any) {
      console.error("Error fetching commission history:", error);
      toast.error("Failed to load commission history");
    } finally {
      setLoading(false);
    }
  };

  // Set up realtime subscription for new verified payments
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel("commission-deposits")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "collections",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          // Refresh if payment was just verified
          if (payload.new.status === "verified" && payload.old?.status !== "verified") {
            fetchCommissionHistory();
            toast.success("💰 New commission deposit received!");
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel);
      });
    };
  }, [agentId]);

  const getDateRange = (): { start: Date; end: Date } | null => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
        }
        return null;
      default:
        return null;
    }
  };

  const filterDeposits = () => {
    let filtered = [...deposits];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (deposit) =>
          deposit.tenant.tenant_name.toLowerCase().includes(query) ||
          deposit.tenant.tenant_phone.includes(query) ||
          (deposit.payment_id && deposit.payment_id.toLowerCase().includes(query)) ||
          (deposit.verified_by_profile?.full_name?.toLowerCase().includes(query))
      );
    }

    // Apply date filter
    const dateRange = getDateRange();
    if (dateRange) {
      filtered = filtered.filter((deposit) => {
        const depositDate = new Date(deposit.verified_at);
        return isWithinInterval(depositDate, { start: dateRange.start, end: dateRange.end });
      });
    }

    setFilteredDeposits(filtered);

    // Update total for filtered results
    const filteredTotal = filtered.reduce((sum, d) => sum + d.commission, 0);
    setTotalCommission(filteredTotal);
  };

  const handleClearDateFilter = () => {
    setDatePreset("all");
    setCustomDateRange({ from: undefined, to: undefined });
  };

  if (loading) {
    return (
      <AgentLayout currentPage="/agent/commission-history">
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-2" />
            <div className="h-4 bg-muted rounded w-96" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout currentPage="/agent/commission-history">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Commission History</h1>
          <p className="text-muted-foreground">
            Complete record of all automatic commission deposits from verified payments
          </p>
        </div>

        {/* Summary Card */}
        <Card className="bg-gradient-to-br from-green-600 via-green-500 to-emerald-500 text-white shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-medium opacity-95">Total Commission Earned</p>
                </div>
                <h2 className="text-4xl font-black tracking-tight">
                  UGX {totalCommission.toLocaleString()}
                </h2>
                <p className="text-xs opacity-90 mt-1">
                  From {filteredDeposits.length} verified payment{filteredDeposits.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                <DollarSign className="h-12 w-12" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by tenant, phone, payment ID, or verifier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Date Range Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={datePreset === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => handleClearDateFilter()}
                className={cn(
                  "h-8 text-xs",
                  datePreset === "all" && "bg-primary hover:bg-primary/90"
                )}
              >
                All Time
              </Button>
              <Button
                variant={datePreset === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setDatePreset("today")}
                className={cn(
                  "h-8 text-xs",
                  datePreset === "today" && "bg-primary hover:bg-primary/90"
                )}
              >
                Today
              </Button>
              <Button
                variant={datePreset === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setDatePreset("week")}
                className={cn(
                  "h-8 text-xs",
                  datePreset === "week" && "bg-primary hover:bg-primary/90"
                )}
              >
                This Week
              </Button>
              <Button
                variant={datePreset === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setDatePreset("month")}
                className={cn(
                  "h-8 text-xs",
                  datePreset === "month" && "bg-primary hover:bg-primary/90"
                )}
              >
                This Month
              </Button>

              {/* Custom Date Range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={datePreset === "custom" ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 text-xs",
                      datePreset === "custom" && "bg-primary hover:bg-primary/90"
                    )}
                  >
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {datePreset === "custom" && customDateRange.from && customDateRange.to
                      ? `${format(customDateRange.from, "MMM d")} - ${format(customDateRange.to, "MMM d")}`
                      : "Custom Range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{
                      from: customDateRange.from,
                      to: customDateRange.to,
                    }}
                    onSelect={(range) => {
                      setCustomDateRange({
                        from: range?.from,
                        to: range?.to,
                      });
                      if (range?.from && range?.to) {
                        setDatePreset("custom");
                      }
                    }}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {datePreset !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearDateFilter}
                  className="h-8 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction List */}
        <Card>
          <CardHeader>
            <CardTitle>Commission Deposits ({filteredDeposits.length})</CardTitle>
            <CardDescription>
              Automatic deposits from verified payments
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredDeposits.length === 0 ? (
              <div className="text-center py-12 px-4">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || datePreset !== "all"
                    ? "No commission deposits match your filters"
                    : "No commission deposits yet"}
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-200 via-green-100 to-transparent" />

                <AnimatePresence mode="popLayout">
                  {filteredDeposits.map((deposit, index) => (
                    <motion.div
                      key={deposit.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="relative px-4 py-4 hover:bg-green-50/30 transition-colors border-b border-green-100/30 last:border-0 cursor-pointer"
                      onClick={() => navigate(`/agent/tenant/${deposit.tenant.id}`)}
                    >
                      {/* Timeline dot */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.03 + 0.1, type: "spring" }}
                        className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"
                      />

                      <div className="ml-12 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Header with badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-green-50 border border-green-200">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            </div>
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Commission Deposit
                            </Badge>
                          </div>

                          {/* Tenant info */}
                          <h3 
                            className="font-semibold text-lg mb-1 cursor-pointer text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/agent/tenant/${deposit.tenant.id}`);
                            }}
                          >
                            {deposit.tenant.tenant_name}
                          </h3>

                          {/* Details grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(deposit.verified_at), "MMM d, yyyy 'at' h:mm a")}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3 w-3" />
                              <span className="font-mono text-xs">
                                {deposit.payment_id || deposit.id.slice(0, 8).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Receipt className="h-3 w-3" />
                              <span className="capitalize">
                                {deposit.payment_method?.replace("_", " ") || "Cash"}
                              </span>
                            </div>
                            {deposit.verified_by_profile?.full_name && (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3" />
                                <span>By {deposit.verified_by_profile.full_name}</span>
                              </div>
                            )}
                          </div>

                          {/* Payment amount */}
                          <div className="mt-2 pt-2 border-t border-green-100/50">
                            <span className="text-xs text-muted-foreground">Payment Amount: </span>
                            <span className="text-sm font-medium">
                              UGX {deposit.amount.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Commission amount */}
                        <div className="text-right flex-shrink-0">
                          <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", delay: index * 0.03 + 0.05 }}
                            className="text-2xl font-bold text-green-600"
                          >
                            +{(deposit.commission / 1000).toFixed(1)}K
                          </motion.div>
                          <div className="text-xs text-muted-foreground">
                            UGX {deposit.commission.toLocaleString()}
                          </div>
                          <Badge variant="outline" className="text-[10px] mt-1 bg-green-50 text-green-700 border-green-200">
                            5% Commission
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
}

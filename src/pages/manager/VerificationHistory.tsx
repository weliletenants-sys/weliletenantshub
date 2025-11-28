import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Search, CheckCircle, XCircle, Clock, Filter, X, ChevronLeft, ChevronRight, CalendarIcon, User, History } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useRealtimeAllCollections, registerSyncCallback } from "@/hooks/useRealtimeSubscription";

interface VerificationRecord {
  id: string;
  amount: number;
  collection_date: string;
  payment_method: string;
  status: string;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  tenant: {
    tenant_name: string;
    tenant_phone: string;
  };
  agent: {
    profiles: {
      full_name: string | null;
      phone_number: string;
    };
  };
  verifier: {
    full_name: string | null;
    phone_number: string;
  } | null;
}

const VerificationHistory = () => {
  const navigate = useNavigate();
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [trendData, setTrendData] = useState<Array<{
    date: string;
    verified: number;
    rejected: number;
    total: number;
  }>>([]);

  const fetchVerifications = async () => {
    try {
      setLoading(true);

      // Build query for trend data (without pagination)
      let trendQuery = supabase
        .from("collections")
        .select("verified_at, status")
        .in("status", ["verified", "rejected"])
        .not("verified_at", "is", null)
        .order("verified_at", { ascending: true });

      // Apply same filters to trend query
      if (statusFilter !== "all") {
        trendQuery = trendQuery.eq("status", statusFilter);
      }

      if (paymentMethodFilter !== "all") {
        trendQuery = trendQuery.eq("payment_method", paymentMethodFilter);
      }

      if (startDate) {
        trendQuery = trendQuery.gte("verified_at", format(startDate, "yyyy-MM-dd"));
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        trendQuery = trendQuery.lte("verified_at", endOfDay.toISOString());
      }

      // Fetch trend data
      const { data: trendRecords } = await trendQuery;

      // Process trend data - group by date
      const trendMap = new Map<string, { verified: number; rejected: number }>();
      
      (trendRecords || []).forEach((record) => {
        const dateKey = format(new Date(record.verified_at!), "yyyy-MM-dd");
        const existing = trendMap.get(dateKey) || { verified: 0, rejected: 0 };
        
        if (record.status === "verified") {
          existing.verified += 1;
        } else if (record.status === "rejected") {
          existing.rejected += 1;
        }
        
        trendMap.set(dateKey, existing);
      });

      // Convert to array and sort by date
      const trendArray = Array.from(trendMap.entries())
        .map(([date, counts]) => ({
          date: format(new Date(date), "MMM dd"),
          fullDate: date,
          verified: counts.verified,
          rejected: counts.rejected,
          total: counts.verified + counts.rejected,
        }))
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

      setTrendData(trendArray);

      // Build query for table data
      let query = supabase
        .from("collections")
        .select(
          `
          id,
          amount,
          collection_date,
          payment_method,
          status,
          verified_at,
          verified_by,
          rejection_reason,
          created_at,
          tenant:tenants!inner(tenant_name, tenant_phone),
          agent:agents!inner(profiles!inner(full_name, phone_number))
        `,
          { count: "exact" }
        )
        .in("status", ["verified", "rejected"])
        .order("verified_at", { ascending: false });

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (paymentMethodFilter !== "all") {
        query = query.eq("payment_method", paymentMethodFilter);
      }

      // Apply date range filter
      if (startDate) {
        query = query.gte("verified_at", format(startDate, "yyyy-MM-dd"));
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("verified_at", endOfDay.toISOString());
      }

      if (searchQuery.trim()) {
        query = query.or(
          `tenant.tenant_name.ilike.%${searchQuery}%,tenant.tenant_phone.ilike.%${searchQuery}%`
        );
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Fetch verifier details for each record
      const verificationsWithVerifiers = await Promise.all(
        (data || []).map(async (verification) => {
          if (verification.verified_by) {
            const { data: verifierData } = await supabase
              .from("profiles")
              .select("full_name, phone_number")
              .eq("id", verification.verified_by)
              .single();

            return {
              ...verification,
              verifier: verifierData,
            };
          }
          return {
            ...verification,
            verifier: null,
          };
        })
      );

      setVerifications(verificationsWithVerifiers);
      setTotalRecords(count || 0);
    } catch (error) {
      console.error("Error fetching verification history:", error);
      toast.error("Failed to load verification history");
    } finally {
      setLoading(false);
    }
  };

  // Enable real-time updates
  useRealtimeAllCollections();

  useEffect(() => {
    fetchVerifications();

    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'collections') {
        console.log(`Real-time update detected on ${table}, refreshing verification history`);
        fetchVerifications();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, [currentPage, statusFilter, paymentMethodFilter, searchQuery, startDate, endDate]);

  const clearFilters = () => {
    setStatusFilter("all");
    setPaymentMethodFilter("all");
    setSearchQuery("");
    setStartDate(undefined);
    setEndDate(undefined);
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== "all" || paymentMethodFilter !== "all" || searchQuery.trim() !== "" || startDate !== undefined || endDate !== undefined;

  const totalPages = Math.ceil(totalRecords / pageSize);
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  const getStatusBadge = (status: string) => {
    if (status === "verified") {
      return (
        <Badge className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge className="bg-red-600">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      cash: "bg-green-600",
      mtn: "bg-yellow-600",
      airtel: "bg-red-600",
    };
    return (
      <Badge className={colors[method.toLowerCase()] || "bg-gray-600"}>
        {method.toUpperCase()}
      </Badge>
    );
  };

  // Statistics
  const verifiedCount = verifications.filter((v) => v.status === "verified").length;
  const rejectedCount = verifications.filter((v) => v.status === "rejected").length;
  const totalVerifiedAmount = verifications
    .filter((v) => v.status === "verified")
    .reduce((sum, v) => sum + Number(v.amount), 0);

  return (
    <ManagerLayout currentPage="/manager/verification-history">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Verification History</h1>
          <p className="text-muted-foreground">
            Complete history of all payment verifications
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Verified
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{verifiedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                UGX {totalVerifiedAmount.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Rejected
                </CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{rejectedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {verifiedCount + rejectedCount > 0
                  ? `${((rejectedCount / (verifiedCount + rejectedCount)) * 100).toFixed(1)}% rejection rate`
                  : "No data"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Records
                </CardTitle>
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalRecords}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all agents
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <div className="flex gap-3 flex-wrap items-center">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                Active
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
          
          {/* Active Date Range Indicator */}
          {(startDate || endDate) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
              <CalendarIcon className="h-4 w-4" />
              <span>
                {startDate && endDate
                  ? `${format(startDate, "MMM dd, yyyy")} - ${format(endDate, "MMM dd, yyyy")}`
                  : startDate
                  ? `From ${format(startDate, "MMM dd, yyyy")}`
                  : `Until ${format(endDate!, "MMM dd, yyyy")}`}
              </span>
            </div>
          )}
        </div>

        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Payment Method</label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mtn">MTN</SelectItem>
                      <SelectItem value="airtel">Airtel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM dd, yyyy") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        disabled={(date) => (endDate ? date > endDate : false)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "MMM dd, yyyy") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => (startDate ? date < startDate : false)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend Chart */}
        {trendData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Verification Trends</CardTitle>
              <CardDescription>
                Daily breakdown of verified and rejected payments
                {(startDate || endDate) && (
                  <span className="ml-2">
                    ({startDate && endDate
                      ? `${format(startDate, "MMM dd, yyyy")} - ${format(endDate, "MMM dd, yyyy")}`
                      : startDate
                      ? `From ${format(startDate, "MMM dd, yyyy")}`
                      : `Until ${format(endDate!, "MMM dd, yyyy")}`})
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="circle"
                    />
                    <Bar 
                      dataKey="verified" 
                      fill="hsl(var(--chart-2))" 
                      name="Verified"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="rejected" 
                      fill="hsl(var(--destructive))" 
                      name="Rejected"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Chart Summary */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-chart-2">
                    {trendData.reduce((sum, d) => sum + d.verified, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Verified</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">
                    {trendData.reduce((sum, d) => sum + d.rejected, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Rejected</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {trendData.reduce((sum, d) => sum + d.total, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Records Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Verification Records</CardTitle>
                <CardDescription>
                  Showing {startRecord} to {endRecord} of {totalRecords} records
                </CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by tenant name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified By</TableHead>
                    <TableHead>Verified At</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Loading verification history...
                      </TableCell>
                    </TableRow>
                  ) : verifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No verification records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    verifications.map((verification) => (
                      <TableRow key={verification.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{verification.tenant.tenant_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {verification.tenant.tenant_phone}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {verification.agent.profiles.full_name || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {verification.agent.profiles.phone_number}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          UGX {Number(verification.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>{getPaymentMethodBadge(verification.payment_method)}</TableCell>
                        <TableCell>{getStatusBadge(verification.status)}</TableCell>
                        <TableCell>
                          {verification.verifier ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {verification.verifier.full_name || "Unknown"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {verification.verifier.phone_number}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {verification.verified_at ? (
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {format(new Date(verification.verified_at), "MMM dd, yyyy")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(verification.verified_at), "hh:mm a")}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {verification.rejection_reason ? (
                            <div className="max-w-xs">
                              <p className="text-sm text-red-600 truncate" title={verification.rejection_reason}>
                                {verification.rejection_reason}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {!loading && totalRecords > 0 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startRecord} to {endRecord} of {totalRecords} records
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default VerificationHistory;

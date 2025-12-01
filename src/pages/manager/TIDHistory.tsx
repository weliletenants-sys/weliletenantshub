import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Calendar, User, Hash, DollarSign, CheckCircle2, XCircle, AlertCircle, TrendingUp, PieChart } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";

interface PaymentRecord {
  id: string;
  payment_id: string;
  amount: number;
  collection_date: string;
  payment_method: string;
  status: string;
  created_by_manager: boolean;
  created_at: string;
  tenant: {
    tenant_name: string;
    tenant_phone: string;
  };
  agent: {
    profiles: {
      full_name: string;
      phone_number: string;
    };
  };
  creator: {
    full_name: string;
    phone_number: string;
    role: string;
  };
}

export default function TIDHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");

  // Fetch all payment records with TID
  const { data: payments, isLoading } = useQuery({
    queryKey: ["tid-history", searchQuery, selectedMethod],
    queryFn: async () => {
      let query = supabase
        .from("collections")
        .select(`
          id,
          payment_id,
          amount,
          collection_date,
          payment_method,
          status,
          created_by_manager,
          created_at,
          tenants!collections_tenant_id_fkey(tenant_name, tenant_phone),
          agents!collections_agent_id_fkey(
            profiles!agents_user_id_fkey(full_name, phone_number)
          ),
          profiles!collections_created_by_fkey(full_name, phone_number, role)
        `)
        .not("payment_id", "is", null)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`payment_id.ilike.%${searchQuery}%,tenants.tenant_name.ilike.%${searchQuery}%`);
      }

      if (selectedMethod !== "all") {
        query = query.eq("payment_method", selectedMethod);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map((record: any) => ({
        id: record.id,
        payment_id: record.payment_id,
        amount: record.amount,
        collection_date: record.collection_date,
        payment_method: record.payment_method,
        status: record.status,
        created_by_manager: record.created_by_manager,
        created_at: record.created_at,
        tenant: record.tenants,
        agent: record.agents,
        creator: record.profiles,
      })) as PaymentRecord[];
    },
  });

  const handleExportCSV = () => {
    if (!payments || payments.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Transaction ID (TID)",
      "Amount",
      "Payment Method",
      "Status",
      "Payment Date",
      "Tenant Name",
      "Tenant Phone",
      "Agent Name",
      "Recorded By",
      "Recorder Role",
      "Created At",
    ];

    const rows = payments.map((payment) => [
      payment.payment_id,
      payment.amount,
      payment.payment_method,
      payment.status,
      format(new Date(payment.collection_date), "PPP p"),
      payment.tenant.tenant_name,
      payment.tenant.tenant_phone,
      payment.agent.profiles.full_name,
      payment.creator.full_name,
      payment.created_by_manager ? "Manager" : "Agent",
      format(new Date(payment.created_at), "PPP p"),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tid-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("TID history exported successfully");
  };

  const totalPayments = payments?.length || 0;
  const totalAmount = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const uniqueTIDs = new Set(payments?.map((p) => p.payment_id)).size;
  const managerRecorded = payments?.filter((p) => p.created_by_manager).length || 0;

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!payments || payments.length === 0) {
      return {
        methodDistribution: [],
        formatCompliance: { compliant: 0, nonCompliant: 0, rate: 0 },
        duplicateStats: { unique: 0, total: 0, duplicateRate: 0 },
      };
    }

    // Payment method distribution
    const methodCounts = payments.reduce((acc, p) => {
      const method = p.payment_method.toUpperCase();
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const methodDistribution = Object.entries(methodCounts).map(([name, value]) => ({
      name,
      value,
      amount: payments
        .filter((p) => p.payment_method.toUpperCase() === name)
        .reduce((sum, p) => sum + p.amount, 0),
    }));

    // Format compliance check
    const validateTidFormat = (tid: string, method: string): boolean => {
      const upperMethod = method.toUpperCase();
      if (upperMethod === "MTN") {
        return /^MTN-[A-Z0-9]{5,}$/i.test(tid);
      } else if (upperMethod === "AIRTEL") {
        return /^ATL-[A-Z0-9]{5,}$/i.test(tid);
      }
      // Cash has no format requirement
      return true;
    };

    let compliant = 0;
    let nonCompliant = 0;

    payments.forEach((p) => {
      if (validateTidFormat(p.payment_id, p.payment_method)) {
        compliant++;
      } else {
        nonCompliant++;
      }
    });

    const formatCompliance = {
      compliant,
      nonCompliant,
      rate: totalPayments > 0 ? (compliant / totalPayments) * 100 : 0,
    };

    // Duplicate statistics
    const tidCounts = payments.reduce((acc, p) => {
      acc[p.payment_id] = (acc[p.payment_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const duplicates = Object.values(tidCounts).filter((count) => count > 1).length;

    const duplicateStats = {
      unique: uniqueTIDs,
      total: totalPayments,
      duplicateRate: totalPayments > 0 ? (duplicates / totalPayments) * 100 : 0,
    };

    return { methodDistribution, formatCompliance, duplicateStats };
  }, [payments, totalPayments, uniqueTIDs]);

  const COLORS = {
    MTN: "hsl(var(--chart-1))",
    AIRTEL: "hsl(var(--chart-2))",
    CASH: "hsl(var(--chart-3))",
  };

  return (
    <ManagerLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Transaction ID (TID) History</h1>
          <p className="text-muted-foreground mt-1">
            Complete audit trail of all payment transactions
          </p>
        </div>

        {/* Analytics Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Method Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Payment Method Distribution
              </CardTitle>
              <CardDescription>Breakdown of transactions by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ChartContainer
                  config={{
                    MTN: { label: "MTN Mobile Money", color: "hsl(var(--chart-1))" },
                    AIRTEL: { label: "Airtel Money", color: "hsl(var(--chart-2))" },
                    CASH: { label: "Cash", color: "hsl(var(--chart-3))" },
                  }}
                  className="h-[250px]"
                >
                  <RechartsPieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={analytics.methodDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.methodDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || "hsl(var(--muted))"} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ChartContainer>
                <div className="space-y-2">
                  {analytics.methodDistribution.map((method) => (
                    <div key={method.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[method.name as keyof typeof COLORS] }}
                        />
                        <span className="font-medium">{method.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{method.value} txns</div>
                        <div className="text-xs text-muted-foreground">
                          UGX {method.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Format Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Format Compliance Rate
              </CardTitle>
              <CardDescription>TID format validation statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <div className="relative h-40 w-40">
                    <svg className="h-full w-full" viewBox="0 0 100 100">
                      <circle
                        className="text-muted stroke-current"
                        strokeWidth="10"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                      ></circle>
                      <circle
                        className="text-primary stroke-current"
                        strokeWidth="10"
                        strokeLinecap="round"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        strokeDasharray={`${analytics.formatCompliance.rate * 2.51} 251`}
                        transform="rotate(-90 50 50)"
                      ></circle>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">{analytics.formatCompliance.rate.toFixed(1)}%</span>
                      <span className="text-xs text-muted-foreground">Compliant</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Compliant
                    </div>
                    <div className="text-2xl font-bold">{analytics.formatCompliance.compliant}</div>
                    <p className="text-xs text-muted-foreground">Valid format</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Non-Compliant
                    </div>
                    <div className="text-2xl font-bold">{analytics.formatCompliance.nonCompliant}</div>
                    <p className="text-xs text-muted-foreground">Invalid format</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted p-3 space-y-1">
                  <div className="text-xs font-semibold">Format Rules:</div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>• MTN: MTN-XXXXX</div>
                    <div>• Airtel: ATL-XXXXX</div>
                    <div>• Cash: No format required</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Duplicate Prevention Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Duplicate Prevention Statistics
            </CardTitle>
            <CardDescription>TID uniqueness and duplicate tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  Unique TIDs
                </div>
                <div className="text-3xl font-bold">{analytics.duplicateStats.unique}</div>
                <p className="text-xs text-muted-foreground">
                  Out of {analytics.duplicateStats.total} total transactions
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Uniqueness Rate
                </div>
                <div className="text-3xl font-bold">
                  {analytics.duplicateStats.total > 0
                    ? ((analytics.duplicateStats.unique / analytics.duplicateStats.total) * 100).toFixed(1)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.duplicateStats.duplicateRate > 0 ? (
                    <span className="text-amber-500">{analytics.duplicateStats.duplicateRate.toFixed(1)}% duplicates detected</span>
                  ) : (
                    <span className="text-green-500">No duplicates detected</span>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  System Status
                </div>
                <div className="text-lg font-semibold text-green-500 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Active
                </div>
                <p className="text-xs text-muted-foreground">
                  Real-time duplicate detection enabled with format validation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPayments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Unique TIDs: {uniqueTIDs}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {totalAmount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Manager Recorded
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{managerRecorded}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalPayments > 0
                  ? ((managerRecorded / totalPayments) * 100).toFixed(1)
                  : 0}
                % of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Agent Recorded
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalPayments - managerRecorded}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalPayments > 0
                  ? (((totalPayments - managerRecorded) / totalPayments) * 100).toFixed(1)
                  : 0}
                % of total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by TID or tenant name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant={selectedMethod === "all" ? "default" : "outline"}
                  onClick={() => setSelectedMethod("all")}
                  size="sm"
                >
                  All
                </Button>
                <Button
                  variant={selectedMethod === "cash" ? "default" : "outline"}
                  onClick={() => setSelectedMethod("cash")}
                  size="sm"
                >
                  Cash
                </Button>
                <Button
                  variant={selectedMethod === "mtn" ? "default" : "outline"}
                  onClick={() => setSelectedMethod("mtn")}
                  size="sm"
                >
                  MTN
                </Button>
                <Button
                  variant={selectedMethod === "airtel" ? "default" : "outline"}
                  onClick={() => setSelectedMethod("airtel")}
                  size="sm"
                >
                  Airtel
                </Button>
              </div>

              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading transaction history...
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Transaction ID
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Amount
                        </div>
                      </TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Recorded By
                        </div>
                      </TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Created At
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono font-semibold">
                          {payment.payment_id}
                        </TableCell>
                        <TableCell className="font-semibold">
                          UGX {payment.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {payment.tenant.tenant_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {payment.tenant.tenant_phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {payment.agent.profiles.full_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {payment.creator.full_name}
                            </div>
                            <Badge
                              variant={
                                payment.created_by_manager ? "default" : "secondary"
                              }
                              className="mt-1"
                            >
                              {payment.created_by_manager ? "Manager" : "Agent"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {payment.payment_method.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.status === "verified"
                                ? "default"
                                : payment.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{format(new Date(payment.created_at), "PPP")}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(payment.created_at), "p")}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}

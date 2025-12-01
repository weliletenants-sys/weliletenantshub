import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { useQueryClient } from "@tanstack/react-query";
import AgentLayout from "@/components/AgentLayout";
import { TenantDetailSkeleton } from "@/components/TenantDetailSkeleton";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { OptimisticBadge } from "@/components/OptimisticBadge";
import { RealtimeSyncIndicator, SyncPulse } from "@/components/RealtimeSyncIndicator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import PaymentReceipt from "@/components/PaymentReceipt";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Phone, User, DollarSign, Calendar, Plus, CloudOff, Receipt, Edit, History, Zap, Loader2, Trash2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { isOnline } from "@/lib/offlineSync";
import { haptics } from "@/utils/haptics";
import { useTenantData, useCollectionsData, useAgentInfo } from "@/hooks/useTenantData";
import { useOptimisticPayment, useOptimisticTenantUpdate } from "@/hooks/useOptimisticPayment";
import { useOptimisticTenantDeletion } from "@/hooks/useOptimisticTenant";
import { useRealtimeCollections } from "@/hooks/useRealtimeSubscription";
import { useRealtimeSyncStatus } from "@/hooks/useRealtimeSyncStatus";

const AgentTenantDetail = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Use React Query hooks for data fetching with caching
  const { data: tenant, isLoading: tenantLoading, isFetching: tenantFetching, error: tenantError } = useTenantData(tenantId);
  const { data: collections = [], isLoading: collectionsLoading, isFetching: collectionsFetching } = useCollectionsData(tenantId);
  const { data: agentInfo } = useAgentInfo();
  
  const loading = tenantLoading || collectionsLoading;
  const isRefreshing = (tenantFetching || collectionsFetching) && !loading;
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lastPayment, setLastPayment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "cash",
    collectionDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [editForm, setEditForm] = useState({
    tenantName: "",
    tenantPhone: "",
    landlordName: "",
    landlordPhone: "",
    lc1Name: "",
    lc1Phone: "",
    rentAmount: "",
    startDate: "",
    dueDate: "",
  });
  const [dailyPaymentAmount, setDailyPaymentAmount] = useState<number | null>(null);
  
  // Optimistic mutations
  const paymentMutation = useOptimisticPayment();
  const tenantUpdateMutation = useOptimisticTenantUpdate();
  const deleteTenantMutation = useOptimisticTenantDeletion();
  
  // Enable real-time updates for collections
  useRealtimeCollections(tenantId);
  
  // Track sync status for visual indicators
  const { lastSyncTime } = useRealtimeSyncStatus('collections');

  // Update edit form when tenant data loads
  useEffect(() => {
    if (tenant) {
      setEditForm({
        tenantName: tenant.tenant_name || "",
        tenantPhone: tenant.tenant_phone || "",
        landlordName: tenant.landlord_name || "",
        landlordPhone: tenant.landlord_phone || "",
        lc1Name: tenant.lc1_name || "",
        lc1Phone: tenant.lc1_phone || "",
        rentAmount: tenant.rent_amount?.toString() || "",
        startDate: tenant.start_date || "",
        dueDate: tenant.due_date || "",
      });
      
      // Set existing daily payment amount if available
      if (tenant.daily_payment_amount) {
        setDailyPaymentAmount(parseFloat(tenant.daily_payment_amount.toString()));
      }
    }
  }, [tenant]);
  
  // Auto-calculate daily payment amount when rent amount or dates change
  useEffect(() => {
    if (editForm.rentAmount && editForm.startDate && editForm.dueDate) {
      const rentAmount = parseFloat(editForm.rentAmount);
      const startDate = new Date(editForm.startDate);
      const dueDate = new Date(editForm.dueDate);
      
      if (rentAmount > 0 && dueDate > startDate) {
        const daysDiff = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const dailyAmount = rentAmount / daysDiff;
        setDailyPaymentAmount(dailyAmount);
      } else {
        setDailyPaymentAmount(null);
      }
    } else {
      setDailyPaymentAmount(null);
    }
  }, [editForm.rentAmount, editForm.startDate, editForm.dueDate]);

  // Handle errors
  useEffect(() => {
    if (tenantError) {
      toast.error("Failed to load tenant details");
      navigate("/agent/tenants");
    }
  }, [tenantError, navigate]);

  const tabs = ["details", "payments", "actions"];

  const handleSwipe = (direction: "left" | "right") => {
    haptics.light();
    const currentIndex = tabs.indexOf(activeTab);
    
    if (direction === "left" && currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    } else if (direction === "right" && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe("left"),
    onSwipedRight: () => handleSwipe("right"),
    trackMouse: false,
    preventScrollOnSwipe: true,
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", emoji: string }> = {
      pending: { variant: "secondary", emoji: "⏰" },
      verified: { variant: "default", emoji: "✅" },
      paying: { variant: "default", emoji: "💰" },
      late: { variant: "destructive", emoji: "⚠️" },
      defaulted: { variant: "destructive", emoji: "❌" },
    };
    const config = statusConfig[status] || { variant: "outline", emoji: "📋" };
    return <Badge variant={config.variant} className="text-base gap-1">{config.emoji} {status}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agent) {
      toast.error("Agent profile not found");
      return;
    }

    const amount = parseFloat(paymentForm.amount);
    const commission = amount * 0.05; // 5% commission

    // Use optimistic mutation
    paymentMutation.mutate({
      tenantId: tenantId!,
      amount,
      paymentMethod: paymentForm.paymentMethod,
      collectionDate: paymentForm.collectionDate,
      agentId: agent.id,
      commission,
    }, {
      onSuccess: (result) => {
        if (!result.offline) {
          // Show receipt for online payments
          setLastPayment({
            amount,
            commission,
            payment_method: paymentForm.paymentMethod,
            collection_date: paymentForm.collectionDate,
            tenant_outstanding_balance: Math.max(0, parseFloat(tenant.outstanding_balance?.toString() || '0') - amount),
          });
          setReceiptDialogOpen(true);
        }
        
        // Reset form
        setPaymentForm({
          amount: "",
          paymentMethod: "cash",
          collectionDate: format(new Date(), "yyyy-MM-dd"),
        });
        setDialogOpen(false);
      }
    });
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const rentAmount = editForm.rentAmount ? parseFloat(editForm.rentAmount) : 0;
    const registrationFee = rentAmount >= 200000 ? 20000 : 10000;

    tenantUpdateMutation.mutate({
      tenantId: tenantId!,
      updates: {
        tenant_name: editForm.tenantName,
        tenant_phone: editForm.tenantPhone,
        landlord_name: editForm.landlordName || "",
        landlord_phone: editForm.landlordPhone || "",
        lc1_name: editForm.lc1Name || "",
        lc1_phone: editForm.lc1Phone || "",
        rent_amount: rentAmount,
        registration_fee: registrationFee,
        start_date: editForm.startDate || null,
        due_date: editForm.dueDate || null,
        daily_payment_amount: dailyPaymentAmount,
      }
    }, {
      onSuccess: () => {
        setEditDialogOpen(false);
      }
    });
  };

  const handleDeleteTenant = async () => {
    if (!tenantId || !tenant) return;
    
    haptics.heavy();
    
    try {
      await deleteTenantMutation.mutateAsync({
        tenantId,
        tenantName: tenant.tenant_name,
        agentId: tenant.agent_id,
        deletionReason: "Deleted by agent"
      });
      
      navigate("/agent/tenants");
    } catch (error: any) {
      console.error('Error deleting tenant:', error);
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <AgentLayout currentPage="/agent/tenants">
        <TenantDetailSkeleton />
      </AgentLayout>
    );
  }

  if (!tenant) {
    return (
      <AgentLayout currentPage="/agent/tenants">
        <div className="text-center py-8">Tenant not found</div>
      </AgentLayout>
    );
  }

  const totalCollected = collections
    .filter(c => c.status === "completed")
    .reduce((sum, c) => sum + parseFloat(c.amount?.toString() || '0'), 0);

  return (
    <AgentLayout currentPage="/agent/tenants">
      <RefreshIndicator isRefreshing={isRefreshing} />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/agent/tenants")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🏠 {tenant.tenant_name}
              <RealtimeSyncIndicator lastSyncTime={lastSyncTime} compact />
            </h1>
            <p className="text-muted-foreground text-sm">Portfolio Details</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge(tenant.status)}
            <OptimisticBadge show={paymentMutation.isPending || tenantUpdateMutation.isPending} />
          </div>
          
          {!isOnline() && (
            <Badge variant="secondary" className="gap-2">
              <CloudOff className="h-3 w-3" />
              Offline Mode
            </Badge>
          )}
          
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg" className="h-12">
                ✏️ Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle>Edit Tenant Details</DialogTitle>
                    <DialogDescription>
                      Update tenant information, landlord, LC1, and rent details
                    </DialogDescription>
                  </div>
                  <OptimisticBadge show={tenantUpdateMutation.isPending} />
                </div>
              </DialogHeader>
              <form onSubmit={handleEditTenant} className="space-y-4">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Tenant Details</h3>
                  <div className="space-y-2">
                    <Label htmlFor="tenantName">Tenant Name</Label>
                    <Input
                      id="tenantName"
                      value={editForm.tenantName}
                      onChange={(e) => setEditForm({ ...editForm, tenantName: e.target.value })}
                      placeholder="Enter tenant name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenantPhone">Tenant Phone</Label>
                    <Input
                      id="tenantPhone"
                      type="tel"
                      value={editForm.tenantPhone}
                      onChange={(e) => setEditForm({ ...editForm, tenantPhone: e.target.value })}
                      placeholder="e.g., 0700123456"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Landlord Details</h3>
                  <div className="space-y-2">
                    <Label htmlFor="landlordName">Landlord Name</Label>
                    <Input
                      id="landlordName"
                      value={editForm.landlordName}
                      onChange={(e) => setEditForm({ ...editForm, landlordName: e.target.value })}
                      placeholder="Enter landlord name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="landlordPhone">Landlord Phone</Label>
                    <Input
                      id="landlordPhone"
                      type="tel"
                      value={editForm.landlordPhone}
                      onChange={(e) => setEditForm({ ...editForm, landlordPhone: e.target.value })}
                      placeholder="e.g., 0700123456"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">LC1 Details</h3>
                  <div className="space-y-2">
                    <Label htmlFor="lc1Name">LC1 Name</Label>
                    <Input
                      id="lc1Name"
                      value={editForm.lc1Name}
                      onChange={(e) => setEditForm({ ...editForm, lc1Name: e.target.value })}
                      placeholder="Enter LC1 name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lc1Phone">LC1 Phone</Label>
                    <Input
                      id="lc1Phone"
                      type="tel"
                      value={editForm.lc1Phone}
                      onChange={(e) => setEditForm({ ...editForm, lc1Phone: e.target.value })}
                      placeholder="e.g., 0700123456"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rentAmount">Monthly Rent Amount (UGX)</Label>
                  <Input
                    id="rentAmount"
                    type="number"
                    value={editForm.rentAmount}
                    onChange={(e) => setEditForm({ ...editForm, rentAmount: e.target.value })}
                    placeholder="Enter monthly rent"
                    min="0"
                  />
                  {editForm.rentAmount && parseFloat(editForm.rentAmount) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Registration fee: UGX {(parseFloat(editForm.rentAmount) >= 200000 ? 20000 : 10000).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    min={editForm.startDate}
                  />
                </div>

                {dailyPaymentAmount !== null && (
                  <div className="rounded-lg bg-primary/10 p-4 space-y-1">
                    <p className="text-sm font-semibold text-primary">Daily Payment Amount</p>
                    <p className="text-2xl font-bold">UGX {dailyPaymentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-muted-foreground">
                      Based on {editForm.rentAmount ? `UGX ${parseFloat(editForm.rentAmount).toLocaleString()}` : 'rent'} over{' '}
                      {editForm.startDate && editForm.dueDate && 
                        Math.ceil((new Date(editForm.dueDate).getTime() - new Date(editForm.startDate).getTime()) / (1000 * 60 * 60 * 24))
                      } days
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={tenantUpdateMutation.isPending}>
                    {tenantUpdateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                💰 Record
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>
                  Record a new payment for {tenant.tenant_name}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (UGX)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="Enter amount"
                    required
                    min="1"
                  />
                  {paymentForm.amount && (
                    <p className="text-xs text-muted-foreground">
                      Your commission: UGX {(parseFloat(paymentForm.amount) * 0.05).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={paymentForm.paymentMethod}
                    onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                      <SelectItem value="airtel">Airtel Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collectionDate">Collection Date</Label>
                  <Input
                    id="collectionDate"
                    type="date"
                    value={paymentForm.collectionDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, collectionDate: e.target.value })}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={paymentMutation.isPending}>
                    {paymentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Record Payment
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Swipeable Tabs Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-14">
            <TabsTrigger value="details" className="text-base">
              📋
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-base">
              💵
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-base">
              ⚡
            </TabsTrigger>
          </TabsList>

          <div {...swipeHandlers} className="mt-6">
            <TabsContent value="details" className="m-0 animate-fade-in">
              {/* Visual Payment Progress */}
              <Card className="mb-6 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border-primary/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">💸 Collection Progress</p>
                      <p className="text-3xl font-bold">
                        {(parseFloat(tenant.rent_amount?.toString() || '0') > 0 
                          ? ((totalCollected / parseFloat(tenant.rent_amount?.toString() || '1')) * 100) 
                          : 0
                        ).toFixed(0)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Balance</p>
                      <p className="text-2xl font-bold text-destructive">
                        {(parseFloat(tenant.outstanding_balance?.toString() || '0') / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>
                  
                  {/* Emoji Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-2xl">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const progress = parseFloat(tenant.rent_amount?.toString() || '0') > 0 
                          ? (totalCollected / parseFloat(tenant.rent_amount?.toString() || '1')) * 10
                          : 0;
                        return (
                          <span key={i} className="transition-all duration-300">
                            {i < progress ? '💰' : '⚪'}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0</span>
                      <span>{(parseFloat(tenant.rent_amount?.toString() || '0') / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className={`transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-highlight-pulse ring-2 ring-primary/20' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">👤 Info</CardTitle>
                      <OptimisticBadge show={tenantUpdateMutation.isPending} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="text-2xl">👤</span>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-semibold">{tenant.tenant_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="text-2xl">📱</span>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-semibold">{tenant.tenant_phone}</p>
                      </div>
                    </div>
                    {tenant.rent_amount > 0 && (
                      <div className={`flex items-center gap-3 p-3 rounded-lg bg-primary/10 transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in' : ''}`}>
                        <span className="text-2xl">💵</span>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Monthly Rent</p>
                          <p className="font-bold">{(parseFloat(tenant.rent_amount?.toString() || '0') / 1000).toFixed(0)}K</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="text-2xl">⏰</span>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Days Left</p>
                        <p className="font-semibold">{tenant.days_remaining || 0}d</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">📊 Stats</CardTitle>
                      <OptimisticBadge show={paymentMutation.isPending} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="text-2xl font-bold text-destructive">
                        {(parseFloat(tenant.outstanding_balance?.toString() || '0') / 1000).toFixed(0)}K
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground">Collected</p>
                      <p className="text-xl font-bold text-primary">
                        {(totalCollected / 1000).toFixed(0)}K
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-xs text-muted-foreground">Payments</p>
                      <p className="text-lg font-semibold">{collections.length} 💳</p>
                    </div>
                    {tenant.daily_payment_amount && parseFloat(tenant.daily_payment_amount.toString()) > 0 && (
                      <div className="p-3 rounded-lg bg-primary/20 border-2 border-primary/40">
                        <p className="text-xs text-muted-foreground">Daily Target</p>
                        <p className="text-xl font-bold text-primary">
                          {(parseFloat(tenant.daily_payment_amount.toString()) / 1000).toFixed(1)}K
                        </p>
                        {tenant.start_date && tenant.due_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📅 {format(new Date(tenant.start_date), "MMM d")} → {format(new Date(tenant.due_date), "MMM d")}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {(tenant.landlord_name || tenant.landlord_phone) && (
                <Card className={`mt-6 transition-all duration-300 relative ${tenantUpdateMutation.isPending ? 'animate-highlight-pulse ring-2 ring-primary/20' : ''}`}>
                  <SyncPulse show={!!lastSyncTime && Date.now() - lastSyncTime.getTime() < 2000} />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">🏠 Landlord</CardTitle>
                      <OptimisticBadge show={tenantUpdateMutation.isPending} />
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {tenant.landlord_name && (
                      <div 
                        className={`p-3 rounded-lg bg-muted/50 transition-all duration-300 cursor-pointer hover:bg-muted active:scale-98 ${tenantUpdateMutation.isPending ? 'animate-fade-in-delay-1' : ''}`}
                        onClick={() => {
                          if (tenant.landlord_id) {
                            navigate(`/agent/landlord/${tenant.landlord_id}`);
                          }
                        }}
                      >
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-semibold text-primary hover:underline">{tenant.landlord_name}</p>
                      </div>
                    )}
                    {tenant.landlord_phone && (
                      <div className={`p-3 rounded-lg bg-muted/50 transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in-delay-2' : ''}`}>
                        <p className="text-xs text-muted-foreground">📞 Phone</p>
                        <p className="font-semibold">{tenant.landlord_phone}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {(tenant.lc1_name || tenant.lc1_phone) && (
                <Card className={`mt-6 transition-all duration-300 relative ${tenantUpdateMutation.isPending ? 'animate-highlight-pulse ring-2 ring-primary/20' : ''}`}>
                  <SyncPulse show={!!lastSyncTime && Date.now() - lastSyncTime.getTime() < 2000} />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">🎯 LC1</CardTitle>
                      <OptimisticBadge show={tenantUpdateMutation.isPending} />
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {tenant.lc1_name && (
                      <div className={`p-3 rounded-lg bg-muted/50 transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in-delay-1' : ''}`}>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-semibold">{tenant.lc1_name}</p>
                      </div>
                    )}
                    {tenant.lc1_phone && (
                      <div className={`p-3 rounded-lg bg-muted/50 transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in-delay-2' : ''}`}>
                        <p className="text-xs text-muted-foreground">📞 Phone</p>
                        <p className="font-semibold">{tenant.lc1_phone}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="payments" className="m-0 animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                  <CardDescription>
                    {collections.length} payment{collections.length !== 1 ? 's' : ''} recorded
                  </CardDescription>
                  
                  {/* Payment Method Filter */}
                  <div className="space-y-3 mt-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Payment Method</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={paymentMethodFilter === "all" ? "default" : "outline"}
                          onClick={() => setPaymentMethodFilter("all")}
                        >
                          All ({collections.length})
                        </Button>
                        <Button
                          size="sm"
                          variant={paymentMethodFilter === "cash" ? "default" : "outline"}
                          onClick={() => setPaymentMethodFilter("cash")}
                        >
                          Cash ({collections.filter(c => c.payment_method === "cash").length})
                        </Button>
                        <Button
                          size="sm"
                          variant={paymentMethodFilter === "mtn" ? "default" : "outline"}
                          onClick={() => setPaymentMethodFilter("mtn")}
                        >
                          MTN ({collections.filter(c => c.payment_method === "mtn").length})
                        </Button>
                        <Button
                          size="sm"
                          variant={paymentMethodFilter === "airtel" ? "default" : "outline"}
                          onClick={() => setPaymentMethodFilter("airtel")}
                        >
                          Airtel ({collections.filter(c => c.payment_method === "airtel").length})
                        </Button>
                      </div>
                    </div>

                    {/* Date Range Filter */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Time Period</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={dateRangeFilter === "all" ? "default" : "outline"}
                          onClick={() => {
                            setDateRangeFilter("all");
                            setCustomDateRange({ from: undefined, to: undefined });
                          }}
                        >
                          All Time
                        </Button>
                        <Button
                          size="sm"
                          variant={dateRangeFilter === "7days" ? "default" : "outline"}
                          onClick={() => {
                            setDateRangeFilter("7days");
                            setCustomDateRange({ from: undefined, to: undefined });
                          }}
                        >
                          Last 7 Days
                        </Button>
                        <Button
                          size="sm"
                          variant={dateRangeFilter === "30days" ? "default" : "outline"}
                          onClick={() => {
                            setDateRangeFilter("30days");
                            setCustomDateRange({ from: undefined, to: undefined });
                          }}
                        >
                          Last 30 Days
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              size="sm"
                              variant={dateRangeFilter === "custom" ? "default" : "outline"}
                              className={cn("gap-2")}
                            >
                              <CalendarIcon className="h-4 w-4" />
                              {dateRangeFilter === "custom" && customDateRange.from ? (
                                customDateRange.to ? (
                                  <>
                                    {format(customDateRange.from, "MMM d")} - {format(customDateRange.to, "MMM d")}
                                  </>
                                ) : (
                                  format(customDateRange.from, "MMM d, yyyy")
                                )
                              ) : (
                                "Custom Range"
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="range"
                              selected={{ from: customDateRange.from, to: customDateRange.to }}
                              onSelect={(range) => {
                                setCustomDateRange({ from: range?.from, to: range?.to });
                                if (range?.from) {
                                  setDateRangeFilter("custom");
                                }
                              }}
                              numberOfMonths={2}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {collections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No payments recorded yet
                    </div>
                  ) : (
                    (() => {
                      // Filter by payment method
                      let filteredCollections = paymentMethodFilter === "all" 
                        ? collections 
                        : collections.filter(c => c.payment_method === paymentMethodFilter);
                      
                      // Filter by date range
                      if (dateRangeFilter !== "all") {
                        const now = new Date();
                        filteredCollections = filteredCollections.filter(c => {
                          const collectionDate = new Date(c.collection_date);
                          
                          if (dateRangeFilter === "7days") {
                            const sevenDaysAgo = new Date(now);
                            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                            return collectionDate >= sevenDaysAgo;
                          } else if (dateRangeFilter === "30days") {
                            const thirtyDaysAgo = new Date(now);
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return collectionDate >= thirtyDaysAgo;
                          } else if (dateRangeFilter === "custom" && customDateRange.from) {
                            const fromDate = new Date(customDateRange.from);
                            fromDate.setHours(0, 0, 0, 0);
                            
                            if (customDateRange.to) {
                              const toDate = new Date(customDateRange.to);
                              toDate.setHours(23, 59, 59, 999);
                              return collectionDate >= fromDate && collectionDate <= toDate;
                            } else {
                              return collectionDate >= fromDate;
                            }
                          }
                          return true;
                        });
                      }
                      
                      return filteredCollections.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No payments found matching the selected filters
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Commission</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredCollections.map((collection) => {
                                const isOptimistic = collection.id.startsWith('optimistic-');
                                return (
                                  <TableRow 
                                    key={collection.id}
                                    className={isOptimistic ? "bg-primary/5" : ""}
                                  >
                                    <TableCell>
                                      {format(new Date(collection.collection_date), "MMM dd, yyyy")}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      UGX {parseFloat(collection.amount?.toString() || '0').toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-primary">
                                      UGX {parseFloat(collection.commission?.toString() || '0').toLocaleString()}
                                    </TableCell>
                                    <TableCell className="capitalize">{collection.payment_method}</TableCell>
                                    <TableCell>
                                      {isOptimistic ? (
                                        <Badge variant="secondary" className="gap-1">
                                          <Zap className="h-3 w-3 animate-pulse" />
                                          Processing
                                        </Badge>
                                      ) : (
                                        getPaymentStatusBadge(collection.status)
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="m-0 animate-fade-in">
              <div className="grid gap-4">
                <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">⚡ Quick Actions</CardTitle>
                    <CardDescription className="text-xs">Common tasks</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      size="lg"
                      className="w-full justify-start h-14 text-base shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-98"
                      onClick={() => setDialogOpen(true)}
                    >
                      <span className="text-xl mr-3">💰</span>
                      Record Payment
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full justify-start h-14 text-base hover:scale-[1.02] active:scale-98 transition-all"
                      onClick={() => setEditDialogOpen(true)}
                    >
                      <span className="text-xl mr-3">✏️</span>
                      Edit Details
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full justify-start h-14 text-base hover:scale-[1.02] active:scale-98 transition-all"
                      onClick={() => {
                        const phone = tenant.tenant_phone.replace(/\s/g, '');
                        const message = `Hi ${tenant.tenant_name}, this is a reminder about your rent payment.`;
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                      }}
                    >
                      <span className="text-xl mr-3">💬</span>
                      WhatsApp
                    </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full justify-start h-14 text-base hover:scale-[1.02] active:scale-98 transition-all"
                        onClick={() => {
                          if (collections.length > 0) {
                            const lastCollection = collections[0];
                            setLastPayment({
                              ...lastCollection,
                              tenant_outstanding_balance: parseFloat(tenant.outstanding_balance?.toString() || '0'),
                            });
                            setReceiptDialogOpen(true);
                          }
                        }}
                        disabled={collections.length === 0}
                      >
                        <span className="text-xl mr-3">🧾</span>
                        Receipt
                      </Button>
                    <div className="pt-2 border-t">
                      <Button
                        variant="destructive"
                        size="lg"
                        className="w-full justify-start h-14 text-base hover:scale-[1.02] active:scale-98 transition-all"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <span className="text-xl mr-3">🗑️</span>
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-accent/5 border-accent/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">💡 Tip</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Swipe ← → to switch tabs faster
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Receipt Dialog */}
        <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payment Receipt</DialogTitle>
              <DialogDescription>
                Share this receipt with the tenant
              </DialogDescription>
            </DialogHeader>
            {lastPayment && agentInfo && (
              <PaymentReceipt
                paymentData={{
                  amount: lastPayment.amount,
                  commission: lastPayment.commission,
                  collectionDate: lastPayment.collection_date,
                  paymentMethod: lastPayment.payment_method,
                  paymentId: lastPayment.payment_id,
                }}
                tenantData={{
                  tenant_name: tenant.tenant_name,
                  tenant_phone: tenant.tenant_phone,
                  rent_amount: parseFloat(tenant.rent_amount?.toString() || '0'),
                  outstanding_balance: lastPayment.tenant_outstanding_balance,
                }}
                agentData={agentInfo}
                receiptNumber={`WLH${Date.now().toString().slice(-8)}`}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{tenant.tenant_name}</strong>? This action cannot be undone and will remove all payment history associated with this tenant.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteTenantMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTenant}
                disabled={deleteTenantMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteTenantMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AgentLayout>
  );
};

export default AgentTenantDetail;

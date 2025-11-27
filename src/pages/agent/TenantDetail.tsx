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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PaymentReceipt from "@/components/PaymentReceipt";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Phone, User, DollarSign, Calendar, Plus, CloudOff, Receipt, Edit, History, Zap, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { isOnline } from "@/lib/offlineSync";
import { haptics } from "@/utils/haptics";
import { useTenantData, useCollectionsData, useAgentInfo } from "@/hooks/useTenantData";
import { useOptimisticPayment, useOptimisticTenantUpdate } from "@/hooks/useOptimisticPayment";
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
  const [lastPayment, setLastPayment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "cash",
    collectionDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [editForm, setEditForm] = useState({
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
  
  // Enable real-time updates for collections
  useRealtimeCollections(tenantId);
  
  // Track sync status for visual indicators
  const { lastSyncTime } = useRealtimeSyncStatus('collections');

  // Update edit form when tenant data loads
  useEffect(() => {
    if (tenant) {
      setEditForm({
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
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      verified: "default",
      paying: "default",
      late: "destructive",
      defaulted: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
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
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {tenant.tenant_name}
              <RealtimeSyncIndicator lastSyncTime={lastSyncTime} compact />
            </h1>
            <p className="text-muted-foreground">Tenant Details & Payment History</p>
          </div>
          <div className="flex items-center gap-2">
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
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Details
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle>Edit Tenant Details</DialogTitle>
                    <DialogDescription>
                      Update landlord, LC1, and rent information
                    </DialogDescription>
                  </div>
                  <OptimisticBadge show={tenantUpdateMutation.isPending} />
                </div>
              </DialogHeader>
              <form onSubmit={handleEditTenant} className="space-y-4">
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
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
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
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">
              <User className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="payments">
              <History className="h-4 w-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="actions">
              <Zap className="h-4 w-4 mr-2" />
              Actions
            </TabsTrigger>
          </TabsList>

          <div {...swipeHandlers} className="mt-6">
            <TabsContent value="details" className="m-0 animate-fade-in">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className={`transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-highlight-pulse ring-2 ring-primary/20' : ''}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Tenant Information</CardTitle>
                      <OptimisticBadge show={tenantUpdateMutation.isPending} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{tenant.tenant_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{tenant.tenant_phone}</p>
                      </div>
                    </div>
                    {tenant.rent_amount > 0 && (
                      <div className={`flex items-center gap-3 transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in' : ''}`}>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Rent</p>
                          <p className="font-medium">UGX {parseFloat(tenant.rent_amount?.toString() || '0').toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Days Remaining</p>
                        <p className="font-medium">{tenant.days_remaining || 0} days</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Payment Summary</CardTitle>
                      <OptimisticBadge show={paymentMutation.isPending} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                      <p className="text-2xl font-bold">
                        UGX {parseFloat(tenant.outstanding_balance?.toString() || '0').toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Collected</p>
                      <p className="text-xl font-semibold text-primary">
                        UGX {totalCollected.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Payments</p>
                      <p className="text-lg font-medium">{collections.length}</p>
                    </div>
                    {tenant.daily_payment_amount && parseFloat(tenant.daily_payment_amount.toString()) > 0 && (
                      <div className="pt-3 border-t">
                        <p className="text-sm text-muted-foreground">Daily Payment Amount</p>
                        <p className="text-xl font-bold text-primary">
                          UGX {parseFloat(tenant.daily_payment_amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        {tenant.start_date && tenant.due_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(tenant.start_date), "MMM d")} - {format(new Date(tenant.due_date), "MMM d, yyyy")}
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
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Landlord Information</CardTitle>
                      <OptimisticBadge show={tenantUpdateMutation.isPending} />
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {tenant.landlord_name && (
                      <div className={`transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in-delay-1' : ''}`}>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{tenant.landlord_name}</p>
                      </div>
                    )}
                    {tenant.landlord_phone && (
                      <div className={`transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in-delay-2' : ''}`}>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{tenant.landlord_phone}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {(tenant.lc1_name || tenant.lc1_phone) && (
                <Card className={`mt-6 transition-all duration-300 relative ${tenantUpdateMutation.isPending ? 'animate-highlight-pulse ring-2 ring-primary/20' : ''}`}>
                  <SyncPulse show={!!lastSyncTime && Date.now() - lastSyncTime.getTime() < 2000} />
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>LC1 Information</CardTitle>
                      <OptimisticBadge show={tenantUpdateMutation.isPending} />
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {tenant.lc1_name && (
                      <div className={`transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in-delay-1' : ''}`}>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{tenant.lc1_name}</p>
                      </div>
                    )}
                    {tenant.lc1_phone && (
                      <div className={`transition-all duration-300 ${tenantUpdateMutation.isPending ? 'animate-fade-in-delay-2' : ''}`}>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{tenant.lc1_phone}</p>
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
                </CardHeader>
                <CardContent>
                  {collections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No payments recorded yet
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
                          {collections.map((collection) => {
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="m-0 animate-fade-in">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Perform common tasks for this tenant</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      className="w-full justify-start"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Record New Payment
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setEditDialogOpen(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Tenant Details
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        const phone = tenant.tenant_phone.replace(/\s/g, '');
                        const message = `Hi ${tenant.tenant_name}, this is a reminder about your rent payment.`;
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                      }}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Send WhatsApp Reminder
                    </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
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
                        <Receipt className="h-4 w-4 mr-2" />
                        View Last Receipt
                      </Button>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-base">Swipe Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      📱 Swipe left or right to navigate between tabs on mobile
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
      </div>
    </AgentLayout>
  );
};

export default AgentTenantDetail;

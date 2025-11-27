import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { useQueryClient } from "@tanstack/react-query";
import AgentLayout from "@/components/AgentLayout";
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
import { ArrowLeft, Phone, User, DollarSign, Calendar, Plus, CloudOff, Receipt, Edit, History, Zap } from "lucide-react";
import { format } from "date-fns";
import { addPendingPayment, isOnline } from "@/lib/offlineSync";
import { haptics } from "@/utils/haptics";
import { useTenantData, useCollectionsData, useAgentInfo } from "@/hooks/useTenantData";

const AgentTenantDetail = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Use React Query hooks for data fetching with caching
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useTenantData(tenantId);
  const { data: collections = [], isLoading: collectionsLoading } = useCollectionsData(tenantId);
  const { data: agentInfo } = useAgentInfo();
  
  const loading = tenantLoading || collectionsLoading;
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  });

  // Update edit form when tenant data loads
  useEffect(() => {
    if (tenant) {
      setEditForm({
        landlordName: tenant.landlord_name || "",
        landlordPhone: tenant.landlord_phone || "",
        lc1Name: tenant.lc1_name || "",
        lc1Phone: tenant.lc1_phone || "",
        rentAmount: tenant.rent_amount?.toString() || "",
      });
    }
  }, [tenant]);

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
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agent) throw new Error("Agent profile not found");

      const amount = parseFloat(paymentForm.amount);
      const commission = amount * 0.05; // 5% commission

      const collectionData = {
        tenant_id: tenantId,
        agent_id: agent.id,
        amount: amount,
        commission: commission,
        collection_date: paymentForm.collectionDate,
        payment_method: paymentForm.paymentMethod,
        status: "completed",
      };

      if (isOnline()) {
        // Online: Save directly to database
        const { error: collectionError } = await supabase
          .from("collections")
          .insert(collectionData);

        if (collectionError) throw collectionError;

        // Update tenant's outstanding balance
        const newBalance = parseFloat(tenant.outstanding_balance?.toString() || '0') - amount;
        const { error: updateError } = await supabase
          .from("tenants")
          .update({ outstanding_balance: Math.max(0, newBalance) })
          .eq("id", tenantId);

        if (updateError) throw updateError;

        // Store payment details for receipt
        setLastPayment({
          ...collectionData,
          tenant_outstanding_balance: Math.max(0, newBalance),
        });

        haptics.success();
        toast.success(`Payment recorded! You earned UGX ${commission.toLocaleString()} commission`);
        
        // Show receipt dialog
        setReceiptDialogOpen(true);
      } else {
        // Offline: Save to IndexedDB for later sync
        await addPendingPayment(collectionData, tenantId!);
        
        toast.success("Payment saved offline! Will sync when back online.", {
          icon: <CloudOff className="h-4 w-4" />,
          duration: 5000,
        });
      }
      
      // Reset form and close dialog
      setPaymentForm({
        amount: "",
        paymentMethod: "cash",
        collectionDate: format(new Date(), "yyyy-MM-dd"),
      });
      setDialogOpen(false);
      
      // Refresh data if online
      if (isOnline()) {
        queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['collections', tenantId] });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const rentAmount = editForm.rentAmount ? parseFloat(editForm.rentAmount) : 0;
      const registrationFee = rentAmount >= 200000 ? 20000 : 10000;

      const { error } = await supabase
        .from("tenants")
        .update({
          landlord_name: editForm.landlordName || "",
          landlord_phone: editForm.landlordPhone || "",
          lc1_name: editForm.lc1Name || "",
          lc1_phone: editForm.lc1Phone || "",
          rent_amount: rentAmount,
          registration_fee: registrationFee,
        })
        .eq("id", tenantId);

      if (error) throw error;

      toast.success("Tenant details updated successfully");
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update tenant");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AgentLayout currentPage="/agent/tenants">
        <div className="text-center py-8">Loading tenant details...</div>
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
            <h1 className="text-3xl font-bold">{tenant.tenant_name}</h1>
            <p className="text-muted-foreground">Tenant Details & Payment History</p>
          </div>
          {getStatusBadge(tenant.status)}
          
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
                <DialogTitle>Edit Tenant Details</DialogTitle>
                <DialogDescription>
                  Update landlord, LC1, and rent information
                </DialogDescription>
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

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Changes"}
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
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? "Recording..." : "Record Payment"}
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
                <Card>
                  <CardHeader>
                    <CardTitle>Tenant Information</CardTitle>
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
                      <div className="flex items-center gap-3">
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
                    <CardTitle>Payment Summary</CardTitle>
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
                  </CardContent>
                </Card>
              </div>

              {(tenant.landlord_name || tenant.landlord_phone) && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Landlord Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {tenant.landlord_name && (
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{tenant.landlord_name}</p>
                      </div>
                    )}
                    {tenant.landlord_phone && (
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{tenant.landlord_phone}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {(tenant.lc1_name || tenant.lc1_phone) && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>LC1 Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {tenant.lc1_name && (
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{tenant.lc1_name}</p>
                      </div>
                    )}
                    {tenant.lc1_phone && (
                      <div>
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
                          {collections.map((collection) => (
                            <TableRow key={collection.id}>
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
                              <TableCell>{getPaymentStatusBadge(collection.status)}</TableCell>
                            </TableRow>
                          ))}
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

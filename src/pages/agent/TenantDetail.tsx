import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PaymentReceipt from "@/components/PaymentReceipt";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Phone, User, DollarSign, Calendar, Plus, CloudOff, Receipt } from "lucide-react";
import { format } from "date-fns";
import { addPendingPayment, isOnline } from "@/lib/offlineSync";

const AgentTenantDetail = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastPayment, setLastPayment] = useState<any>(null);
  const [agentInfo, setAgentInfo] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "cash",
    collectionDate: format(new Date(), "yyyy-MM-dd"),
  });

  useEffect(() => {
    fetchTenantDetails();
    fetchAgentInfo();
  }, [tenantId]);

  const fetchAgentInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone_number")
        .eq("id", user.id)
        .single();

      if (profile) {
        setAgentInfo({
          agent_name: profile.full_name || "Agent",
          agent_phone: profile.phone_number || "",
        });
      }
    } catch (error) {
      console.error("Error fetching agent info:", error);
    }
  };

  const fetchTenantDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agent) return;

      // Fetch tenant details
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .eq("agent_id", agent.id)
        .single();

      if (tenantError) throw tenantError;
      setTenant(tenantData);

      // Fetch collections history
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("collections")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("collection_date", { ascending: false });

      if (collectionsError) throw collectionsError;
      setCollections(collectionsData || []);
    } catch (error: any) {
      toast.error("Failed to load tenant details");
      navigate("/agent/tenants");
    } finally {
      setLoading(false);
    }
  };

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
        const newBalance = parseFloat(tenant.outstanding_balance) - amount;
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
        fetchTenantDetails();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to record payment");
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
    .reduce((sum, c) => sum + parseFloat(c.amount), 0);

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
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Rent</p>
                  <p className="font-medium">UGX {parseFloat(tenant.rent_amount).toLocaleString()}</p>
                </div>
              </div>
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
                  UGX {parseFloat(tenant.outstanding_balance).toLocaleString()}
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

        <Card>
          <CardHeader>
            <CardTitle>Landlord Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{tenant.landlord_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{tenant.landlord_phone}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>LC1 Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{tenant.lc1_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{tenant.lc1_phone}</p>
            </div>
          </CardContent>
        </Card>

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
                          UGX {parseFloat(collection.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-primary">
                          UGX {parseFloat(collection.commission).toLocaleString()}
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
                  rent_amount: parseFloat(tenant.rent_amount),
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

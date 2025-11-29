import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Receipt, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import PaymentReceipt from "@/components/PaymentReceipt";
import { toast } from "sonner";

interface PaymentRecord {
  id: string;
  amount: number;
  commission: number;
  collection_date: string;
  payment_method: string;
  status: string;
  tenant: {
    id: string;
    tenant_name: string;
    tenant_phone: string;
    rent_amount: number;
    outstanding_balance: number;
  };
  agent: {
    profiles: {
      full_name: string;
      phone_number: string;
    };
  };
}

export default function ReceiptHistory() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    filterPayments();
  }, [searchQuery, payments]);

  const fetchPayments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get agent ID
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (agentError) throw agentError;

      // Fetch all collections with tenant and agent details
      const { data, error } = await supabase
        .from("collections")
        .select(`
          *,
          tenant:tenants (
            id,
            tenant_name,
            tenant_phone,
            rent_amount,
            outstanding_balance
          ),
          agent:agents!collections_agent_id_fkey (
            profiles:user_id (
              full_name,
              phone_number
            )
          )
        `)
        .eq("agent_id", agentData.id)
        .eq("status", "verified")
        .order("collection_date", { ascending: false });

      if (error) throw error;

      setPayments((data || []) as unknown as PaymentRecord[]);
      setFilteredPayments((data || []) as unknown as PaymentRecord[]);
    } catch (error: any) {
      console.error("Error fetching payments:", error);
      toast.error("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    if (!searchQuery.trim()) {
      setFilteredPayments(payments);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = payments.filter(
      (payment) =>
        payment.tenant.tenant_name.toLowerCase().includes(query) ||
        payment.tenant.tenant_phone.includes(query) ||
        payment.payment_method.toLowerCase().includes(query) ||
        format(new Date(payment.collection_date), "MMM dd, yyyy").toLowerCase().includes(query)
    );
    setFilteredPayments(filtered);
  };

  const handleViewReceipt = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setShowReceipt(true);
  };

  const generateReceiptNumber = (paymentId: string) => {
    return `REC-${paymentId.slice(-8).toUpperCase()}`;
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Receipt History</h1>
          <p className="text-muted-foreground">
            View and re-share receipts for all your verified payments
          </p>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by tenant name, phone, date, or payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payments.length}</div>
              <p className="text-xs text-muted-foreground">Verified payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {payments.reduce((sum, p) => sum + p.commission, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Earned</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Records */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Records ({filteredPayments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No receipts match your search" : "No payment receipts yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayments.map((payment) => (
                  <Card
                    key={payment.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleViewReceipt(payment)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Receipt className="h-4 w-4 text-primary flex-shrink-0" />
                            <h3 className="font-semibold truncate">
                              {payment.tenant.tenant_name}
                            </h3>
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Verified
                            </Badge>
                          </div>
                           <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div>
                              <span className="text-muted-foreground">Receipt:</span>
                              <span className="ml-2 font-mono text-xs">
                                {generateReceiptNumber(payment.id)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Amount:</span>
                              <span className="ml-2 font-semibold">
                                UGX {payment.amount.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date:</span>
                              <span className="ml-2">
                                {format(new Date(payment.collection_date), "MMM dd, yyyy")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Method:</span>
                              <span className="ml-2 capitalize">
                                {payment.payment_method.replace("_", " ")}
                              </span>
                            </div>
                            <div className="col-span-2 mt-2 pt-2 border-t">
                              <span className="text-muted-foreground">Your Commission:</span>
                              <span className="ml-2 font-bold text-success text-base">
                                +UGX {payment.commission.toLocaleString()}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                (5% of payment)
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          handleViewReceipt(payment);
                        }}>
                          <Receipt className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Dialog */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payment Receipt</DialogTitle>
            </DialogHeader>
            {selectedPayment && (
              <PaymentReceipt
                paymentData={{
                  amount: selectedPayment.amount,
                  commission: selectedPayment.commission,
                  collectionDate: selectedPayment.collection_date,
                  paymentMethod: selectedPayment.payment_method,
                }}
                tenantData={{
                  tenant_name: selectedPayment.tenant.tenant_name,
                  tenant_phone: selectedPayment.tenant.tenant_phone,
                  rent_amount: selectedPayment.tenant.rent_amount || 0,
                  outstanding_balance: selectedPayment.tenant.outstanding_balance || 0,
                }}
                agentData={{
                  agent_name: selectedPayment.agent.profiles?.full_name || "Agent",
                  agent_phone: selectedPayment.agent.profiles?.phone_number || "",
                }}
                receiptNumber={generateReceiptNumber(selectedPayment.id)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
}

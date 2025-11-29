import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/ManagerLayout";
import { PaymentVerificationsSkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, User, DollarSign, Calendar, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PaymentReceipt from "@/components/PaymentReceipt";
import { useOptimisticPaymentVerification, useOptimisticPaymentRejection, useUndoPaymentAction } from "@/hooks/useOptimisticPaymentVerification";
import { haptics } from "@/utils/haptics";
import { Undo2 } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  commission: number;
  collection_date: string;
  payment_method: string | null;
  status: string | null;
  created_at: string;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  agent_id: string;
  tenant_id: string;
  agent: {
    user_id: string;
    profiles: {
      full_name: string | null;
      phone_number: string;
    };
  };
  tenants: {
    tenant_name: string;
    tenant_phone: string;
  };
}

const PaymentVerifications = () => {
  const queryClient = useQueryClient();
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);
  const [tenantDetails, setTenantDetails] = useState<any>(null);
  const [loadingTenant, setLoadingTenant] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pending");
  
  // Optimistic mutations
  const verifyMutation = useOptimisticPaymentVerification();
  const rejectMutation = useOptimisticPaymentRejection();
  const undoMutation = useUndoPaymentAction();
  
  // Track recent actions for undo (paymentId -> {undoData, toastId, timeoutId})
  const [recentActions, setRecentActions] = useState<Map<string, any>>(new Map());

  // Fetch all payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select(`
          *,
          agent:agents!inner (
            user_id,
            profiles!agents_user_id_fkey (
              full_name,
              phone_number
            )
          ),
          tenants!inner(tenant_name, tenant_phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('payment-verifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections'
        },
        (payload) => {
          console.log('Payment change detected:', payload);
          
          // Invalidate and refetch payment data
          queryClient.invalidateQueries({ queryKey: ["all-payments"] });
          
          // Show notification for new payments
          if (payload.eventType === 'INSERT') {
            toast.info('New payment submission received', {
              description: 'Payment list updated automatically',
            });
          } else if (payload.eventType === 'UPDATE') {
            toast.info('Payment status updated', {
              description: 'Changes reflected automatically',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      recentActions.forEach(action => {
        if (action.timeoutId) {
          clearTimeout(action.timeoutId);
        }
      });
    };
  }, [recentActions]);

  const handleVerify = async (payment: Payment) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      haptics.light();
      const result = await verifyMutation.mutateAsync({
        paymentId: payment.id,
        managerId: user.id
      });

      // Store undo data
      const undoData = {
        paymentId: payment.id,
        previousStatus: verifyMutation.context?.previousStatus || payment.status || 'pending',
        previousVerifiedBy: verifyMutation.context?.previousVerifiedBy || payment.verified_by,
        previousVerifiedAt: verifyMutation.context?.previousVerifiedAt || payment.verified_at,
        previousRejectionReason: verifyMutation.context?.previousRejectionReason || payment.rejection_reason,
        tenantName: payment.tenants.tenant_name
      };

      // Show undo toast with 120 second duration
      const toastId = toast.success(`Payment verified for ${payment.tenants.tenant_name}`, {
        description: 'Tap Undo to revert this action',
        duration: 120000, // 120 seconds
        action: {
          label: 'Undo',
          onClick: () => handleUndo(payment.id),
        },
      });

      // Set timeout to remove from recentActions after 120 seconds
      const timeoutId = setTimeout(() => {
        setRecentActions(prev => {
          const newMap = new Map(prev);
          newMap.delete(payment.id);
          return newMap;
        });
      }, 120000);

      // Track this action
      setRecentActions(prev => new Map(prev).set(payment.id, { undoData, toastId, timeoutId }));
    } catch (error) {
      console.error("Error verifying payment:", error);
    }
  };

  const handleReject = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowRejectDialog(true);
  };

  const handleViewReceipt = async (payment: Payment) => {
    setPreviewPayment(payment);
    setLoadingTenant(true);
    setShowReceiptPreview(true);
    
    // Fetch full tenant details including balance
    try {
      const { data: tenant, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", payment.tenant_id)
        .single();

      if (error) throw error;
      setTenantDetails(tenant);
    } catch (error) {
      console.error("Error fetching tenant details:", error);
      toast.error("Failed to load tenant details");
    } finally {
      setLoadingTenant(false);
    }
  };

  const confirmReject = async () => {
    if (!selectedPayment || !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      haptics.light();
      const result = await rejectMutation.mutateAsync({
        paymentId: selectedPayment.id,
        managerId: user.id,
        reason: rejectionReason
      });

      // Store undo data
      const undoData = {
        paymentId: selectedPayment.id,
        previousStatus: rejectMutation.context?.previousStatus || selectedPayment.status || 'pending',
        previousVerifiedBy: rejectMutation.context?.previousVerifiedBy || selectedPayment.verified_by,
        previousVerifiedAt: rejectMutation.context?.previousVerifiedAt || selectedPayment.verified_at,
        previousRejectionReason: rejectMutation.context?.previousRejectionReason || selectedPayment.rejection_reason,
        tenantName: selectedPayment.tenants.tenant_name
      };

      // Show undo toast with 120 second duration
      const toastId = toast.error(`Payment rejected for ${selectedPayment.tenants.tenant_name}`, {
        description: 'Tap Undo to revert this action',
        duration: 120000, // 120 seconds
        action: {
          label: 'Undo',
          onClick: () => handleUndo(selectedPayment.id),
        },
      });

      // Set timeout to remove from recentActions after 120 seconds
      const timeoutId = setTimeout(() => {
        setRecentActions(prev => {
          const newMap = new Map(prev);
          newMap.delete(selectedPayment.id);
          return newMap;
        });
      }, 120000);

      // Track this action
      setRecentActions(prev => new Map(prev).set(selectedPayment.id, { undoData, toastId, timeoutId }));
      
      setShowRejectDialog(false);
      setSelectedPayment(null);
      setRejectionReason("");
    } catch (error) {
      console.error("Error rejecting payment:", error);
    }
  };

  const handleUndo = async (paymentId: string) => {
    const actionData = recentActions.get(paymentId);
    if (!actionData) {
      toast.error("Cannot undo: action expired or not found");
      return;
    }

    try {
      // Clear the timeout
      if (actionData.timeoutId) {
        clearTimeout(actionData.timeoutId);
      }

      // Dismiss the original toast
      toast.dismiss(actionData.toastId);

      // Perform undo
      await undoMutation.mutateAsync(actionData.undoData);

      // Remove from recent actions
      setRecentActions(prev => {
        const newMap = new Map(prev);
        newMap.delete(paymentId);
        return newMap;
      });
    } catch (error) {
      console.error("Error undoing action:", error);
    }
  };

  const pendingPayments = payments?.filter(p => p.status === "pending") || [];
  const verifiedPayments = payments?.filter(p => p.status === "verified") || [];
  const rejectedPayments = payments?.filter(p => p.status === "rejected") || [];

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-600">Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const PaymentCard = ({ payment }: { payment: Payment }) => (
    <Card className="mb-4">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">{payment.tenants.tenant_name}</h3>
            <p className="text-sm text-muted-foreground mb-2">{payment.tenants.tenant_phone}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <User className="h-4 w-4" />
              <span>Agent: {payment.agent.profiles.full_name || payment.agent.profiles.phone_number}</span>
            </div>
          </div>
          {getStatusBadge(payment.status)}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-semibold">UGX {payment.amount.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Commission</p>
              <p className="font-semibold">UGX {payment.commission.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {format(new Date(payment.collection_date), "MMM dd, yyyy")}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{payment.payment_method || "Cash"}</span>
        </div>

        {payment.rejection_reason && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
            <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
            <p className="text-sm text-muted-foreground">{payment.rejection_reason}</p>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleViewReceipt(payment)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Receipt
          </Button>
          
          {payment.status === "pending" && (
            <>
              <Button
                className="flex-1"
                onClick={() => handleVerify(payment)}
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Verify
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleReject(payment)}
                disabled={rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <ManagerLayout currentPage="/manager/payment-verifications">
        <PaymentVerificationsSkeleton />
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/payment-verifications">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Payment Verifications</h1>
        <p className="text-muted-foreground">Review and verify agent payment submissions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingPayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting verification</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{verifiedPayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Commission applied</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{rejectedPayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">No commission</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Submissions</CardTitle>
          <CardDescription>Review agent payment entries and verify for commission approval</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="pending">
                Pending ({pendingPayments.length})
              </TabsTrigger>
              <TabsTrigger value="verified">
                Verified ({verifiedPayments.length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({rejectedPayments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pendingPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pending payments</p>
                </div>
              ) : (
                <div>
                  {pendingPayments.map(payment => (
                    <PaymentCard key={payment.id} payment={payment} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="verified">
              {verifiedPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No verified payments</p>
                </div>
              ) : (
                <div>
                  {verifiedPayments.map(payment => (
                    <PaymentCard key={payment.id} payment={payment} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {rejectedPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <X className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No rejected payments</p>
                </div>
              ) : (
                <div>
                  {rejectedPayments.map(payment => (
                    <PaymentCard key={payment.id} payment={payment} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this payment. This will be recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRejectDialog(false);
              setRejectionReason("");
              setSelectedPayment(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReject}
              className="bg-destructive hover:bg-destructive/90"
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={showReceiptPreview} onOpenChange={setShowReceiptPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Receipt Preview</DialogTitle>
          </DialogHeader>
          {loadingTenant ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : previewPayment && tenantDetails ? (
            <PaymentReceipt
              paymentData={{
                amount: previewPayment.amount,
                commission: previewPayment.commission,
                collectionDate: previewPayment.collection_date,
                paymentMethod: previewPayment.payment_method || "cash",
              }}
              tenantData={{
                tenant_name: previewPayment.tenants.tenant_name,
                tenant_phone: previewPayment.tenants.tenant_phone,
                rent_amount: tenantDetails.rent_amount || 0,
                outstanding_balance: tenantDetails.outstanding_balance || 0,
              }}
              agentData={{
                agent_name: previewPayment.agent.profiles.full_name || previewPayment.agent.profiles.phone_number,
                agent_phone: previewPayment.agent.profiles.phone_number,
              }}
              receiptNumber={previewPayment.id.slice(0, 8).toUpperCase()}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No receipt data available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ManagerLayout>
  );
};

export default PaymentVerifications;

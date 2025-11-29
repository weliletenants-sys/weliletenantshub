import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/ManagerLayout";
import { PaymentVerificationsSkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, User, DollarSign, Calendar, Loader2, Eye, CheckSquare, Square } from "lucide-react";
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
import { Undo2, History } from "lucide-react";
import { UndoHistoryDialog, UndoHistoryEntry } from "@/components/UndoHistoryDialog";

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
  const [showUndoHistory, setShowUndoHistory] = useState(false);
  const [undoHistory, setUndoHistory] = useState<UndoHistoryEntry[]>(() => {
    // Load undo history from localStorage on mount
    const saved = localStorage.getItem('payment-undo-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Clear selection when switching tabs
    setSelectedPaymentIds(new Set());
  };
  
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

      // Determine action type from the undoData
      const wasVerified = actionData.undoData.previousStatus === 'pending' && 
                         payments?.find((p: Payment) => p.id === paymentId)?.status === 'verified';
      const wasRejected = actionData.undoData.previousStatus === 'pending' && 
                         payments?.find((p: Payment) => p.id === paymentId)?.status === 'rejected';

      // Perform undo
      await undoMutation.mutateAsync(actionData.undoData);

      // Add to undo history
      const historyEntry: UndoHistoryEntry = {
        id: `${paymentId}-${Date.now()}`,
        paymentId: paymentId,
        tenantName: actionData.undoData.tenantName,
        actionType: wasVerified ? 'verify' : 'reject',
        undoneAt: new Date(),
        previousStatus: actionData.undoData.previousStatus,
        rejectionReason: wasRejected ? actionData.undoData.previousRejectionReason : undefined
      };

      const newHistory = [...undoHistory, historyEntry];
      setUndoHistory(newHistory);
      
      // Save to localStorage
      localStorage.setItem('payment-undo-history', JSON.stringify(newHistory));

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

  const handleClearUndoHistory = () => {
    setUndoHistory([]);
    localStorage.removeItem('payment-undo-history');
    toast.success("Undo history cleared");
  };

  const togglePaymentSelection = (paymentId: string) => {
    setSelectedPaymentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  const selectAllPending = () => {
    setSelectedPaymentIds(new Set(pendingPayments.map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedPaymentIds(new Set());
  };

  const handleBulkVerify = async () => {
    if (selectedPaymentIds.size === 0) {
      toast.error("No payments selected");
      return;
    }

    try {
      setIsBulkProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const selectedPayments = pendingPayments.filter(p => selectedPaymentIds.has(p.id));
      let successCount = 0;
      let errorCount = 0;

      for (const payment of selectedPayments) {
        try {
          await verifyMutation.mutateAsync({
            paymentId: payment.id,
            managerId: user.id
          });
          successCount++;
        } catch (error) {
          console.error(`Error verifying payment ${payment.id}:`, error);
          errorCount++;
        }
      }

      haptics.success();
      toast.success(`Bulk verification complete`, {
        description: `${successCount} verified${errorCount > 0 ? `, ${errorCount} failed` : ''}`
      });

      setSelectedPaymentIds(new Set());
    } catch (error) {
      console.error("Error in bulk verification:", error);
      toast.error("Failed to complete bulk verification");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedPaymentIds.size === 0) {
      toast.error("No payments selected");
      return;
    }

    // For bulk rejection, we'll use a default reason
    const reason = "Bulk rejection by manager";
    
    try {
      setIsBulkProcessing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const selectedPayments = pendingPayments.filter(p => selectedPaymentIds.has(p.id));
      let successCount = 0;
      let errorCount = 0;

      for (const payment of selectedPayments) {
        try {
          await rejectMutation.mutateAsync({
            paymentId: payment.id,
            managerId: user.id,
            reason
          });
          successCount++;
        } catch (error) {
          console.error(`Error rejecting payment ${payment.id}:`, error);
          errorCount++;
        }
      }

      haptics.success();
      toast.success(`Bulk rejection complete`, {
        description: `${successCount} rejected${errorCount > 0 ? `, ${errorCount} failed` : ''}`
      });

      setSelectedPaymentIds(new Set());
    } catch (error) {
      console.error("Error in bulk rejection:", error);
      toast.error("Failed to complete bulk rejection");
    } finally {
      setIsBulkProcessing(false);
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

  const PaymentCard = ({ payment }: { payment: Payment }) => {
    const isSelected = selectedPaymentIds.has(payment.id);
    const isPending = payment.status === "pending";
    
    return (
      <Card className={`mb-4 transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-start gap-3 flex-1">
              {isPending && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 mt-1"
                  onClick={() => togglePaymentSelection(payment.id)}
                >
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-primary" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </Button>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{payment.tenants.tenant_name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{payment.tenants.tenant_phone}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <User className="h-4 w-4" />
                  <span>Agent: {payment.agent.profiles.full_name || payment.agent.profiles.phone_number}</span>
                </div>
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
            <DollarSign className={`h-5 w-5 ${
              payment.status === 'verified' ? 'text-green-600' : 
              payment.status === 'rejected' ? 'text-muted-foreground' : 
              'text-yellow-600'
            }`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Commission</p>
                {payment.status === 'verified' && (
                  <Badge variant="secondary" className="bg-green-600/10 text-green-700 text-[10px] px-1.5 py-0">
                    Applied
                  </Badge>
                )}
                {payment.status === 'pending' && (
                  <Badge variant="secondary" className="bg-yellow-600/10 text-yellow-700 text-[10px] px-1.5 py-0">
                    Pending
                  </Badge>
                )}
                {payment.status === 'rejected' && (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0">
                    Not Applied
                  </Badge>
                )}
              </div>
              <p className={`font-semibold ${
                payment.status === 'verified' ? 'text-green-700' : 
                payment.status === 'rejected' ? 'text-muted-foreground line-through' : 
                ''
              }`}>
                UGX {payment.commission.toLocaleString()}
              </p>
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
  };

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Payment Verifications</h1>
            <p className="text-muted-foreground">Review and verify agent payment submissions</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowUndoHistory(true)}
            className="flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            Undo History
            {undoHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {undoHistory.length}
              </Badge>
            )}
          </Button>
        </div>
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

      {/* Bulk Actions Toolbar */}
      {selectedPaymentIds.size > 0 && (
        <Card className="mb-6 border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  <span className="font-semibold">
                    {selectedPaymentIds.size} payment{selectedPaymentIds.size > 1 ? 's' : ''} selected
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  className="h-8"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-3">
                {activeTab === 'pending' && (
                  <>
                    <Button
                      onClick={handleBulkVerify}
                      disabled={isBulkProcessing}
                      className="gap-2"
                    >
                      {isBulkProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Verify All Selected
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleBulkReject}
                      disabled={isBulkProcessing}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Reject All Selected
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment Submissions</CardTitle>
          <CardDescription>Review agent payment entries and verify for commission approval</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
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
                  <div className="flex items-center justify-between mb-4 pb-3 border-b">
                    <p className="text-sm text-muted-foreground">
                      {selectedPaymentIds.size > 0 
                        ? `${selectedPaymentIds.size} of ${pendingPayments.length} selected`
                        : `${pendingPayments.length} pending payment${pendingPayments.length > 1 ? 's' : ''}`
                      }
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectedPaymentIds.size === pendingPayments.length ? deselectAll : selectAllPending}
                    >
                      {selectedPaymentIds.size === pendingPayments.length ? (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          Deselect All
                        </>
                      ) : (
                        <>
                          <CheckSquare className="h-4 w-4 mr-2" />
                          Select All
                        </>
                      )}
                    </Button>
                  </div>
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

      {/* Undo History Dialog */}
      <UndoHistoryDialog
        open={showUndoHistory}
        onOpenChange={setShowUndoHistory}
        history={undoHistory}
        onClearHistory={handleClearUndoHistory}
      />

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

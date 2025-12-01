import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Wallet,
  ArrowDownToLine,
  User,
  Phone,
  Calendar,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { haptics } from "@/utils/haptics";
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
import { Label } from "@/components/ui/label";

export default function WithdrawalApprovals() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["withdrawal-requests", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("withdrawal_requests")
        .select(`
          *,
          agent:agents!withdrawal_requests_agent_id_fkey(
            id,
            wallet_balance,
            user:profiles!agents_user_id_fkey(
              full_name,
              phone_number
            )
          ),
          approver:profiles!withdrawal_requests_approved_by_fkey(
            full_name
          )
        `)
        .order("requested_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = withdrawals?.find(w => w.id === requestId);
      if (!request) throw new Error("Request not found");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update withdrawal request status
      const { error: updateError } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // Deduct from agent wallet
      const newBalance = (request.agent.wallet_balance || 0) - request.amount;
      const { error: walletError } = await supabase
        .from("agents")
        .update({ wallet_balance: newBalance })
        .eq("id", request.agent_id);

      if (walletError) throw walletError;
    },
    onSuccess: () => {
      haptics.success();
      toast.success("Withdrawal approved successfully");
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
    },
    onError: (error: any) => {
      console.error("Error approving withdrawal:", error);
      toast.error("Failed to approve withdrawal");
      haptics.error();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "rejected",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          rejection_reason: reason,
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      toast.success("Withdrawal rejected");
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
    },
    onError: (error: any) => {
      console.error("Error rejecting withdrawal:", error);
      toast.error("Failed to reject withdrawal");
      haptics.error();
    },
  });

  const handleReject = (request: any) => {
    haptics.light();
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  const confirmReject = () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectMutation.mutate({ 
      requestId: selectedRequest.id, 
      reason: rejectionReason 
    });
  };

  const pendingCount = withdrawals?.filter(w => w.status === "pending").length || 0;
  const approvedCount = withdrawals?.filter(w => w.status === "approved").length || 0;
  const rejectedCount = withdrawals?.filter(w => w.status === "rejected").length || 0;
  const pendingAmount = withdrawals?.filter(w => w.status === "pending")
    .reduce((sum, w) => sum + Number(w.amount), 0) || 0;

  return (
    <ManagerLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-purple-900 mb-2">Withdrawal Approvals</h1>
          <p className="text-purple-600">Review and approve agent withdrawal requests</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Pending Requests</p>
                  <p className="text-3xl font-bold text-orange-900">{pendingCount}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Approved</p>
                  <p className="text-3xl font-bold text-green-900">{approvedCount}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Rejected</p>
                  <p className="text-3xl font-bold text-red-900">{rejectedCount}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Pending Amount</p>
                  <p className="text-2xl font-bold text-purple-900">
                    UGX {pendingAmount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Wallet className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterStatus === "pending" ? "default" : "outline"}
            onClick={() => {
              haptics.light();
              setFilterStatus("pending");
            }}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            variant={filterStatus === "approved" ? "default" : "outline"}
            onClick={() => {
              haptics.light();
              setFilterStatus("approved");
            }}
          >
            Approved ({approvedCount})
          </Button>
          <Button
            variant={filterStatus === "rejected" ? "default" : "outline"}
            onClick={() => {
              haptics.light();
              setFilterStatus("rejected");
            }}
          >
            Rejected ({rejectedCount})
          </Button>
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            onClick={() => {
              haptics.light();
              setFilterStatus("all");
            }}
          >
            All
          </Button>
        </div>

        {/* Withdrawal Requests */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : withdrawals && withdrawals.length > 0 ? (
          <div className="space-y-4">
            {withdrawals.map((withdrawal) => (
              <Card key={withdrawal.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <ArrowDownToLine className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-purple-600" />
                            <span className="font-semibold text-purple-900">
                              {withdrawal.agent.user.full_name || "Unknown Agent"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-purple-600">
                            <Phone className="h-3 w-3" />
                            <span>{withdrawal.agent.user.phone_number}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Withdrawal Amount</p>
                          <p className="text-lg font-bold text-purple-900">
                            UGX {Number(withdrawal.amount).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Wallet Balance</p>
                          <p className="text-lg font-semibold">
                            UGX {Number(withdrawal.agent.wallet_balance || 0).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <p className="text-sm">{format(new Date(withdrawal.requested_at), "MMM d, yyyy")}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge
                            variant={
                              withdrawal.status === "approved"
                                ? "default"
                                : withdrawal.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {withdrawal.status}
                          </Badge>
                        </div>
                      </div>

                      {withdrawal.status === "rejected" && withdrawal.rejection_reason && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-xs text-red-600 font-medium mb-1">Rejection Reason:</p>
                          <p className="text-sm text-red-900">{withdrawal.rejection_reason}</p>
                        </div>
                      )}

                      {withdrawal.status !== "pending" && withdrawal.approver && (
                        <div className="text-xs text-muted-foreground">
                          {withdrawal.status === "approved" ? "Approved" : "Rejected"} by{" "}
                          {withdrawal.approver.full_name} on{" "}
                          {format(new Date(withdrawal.approved_at), "MMM d, yyyy HH:mm")}
                        </div>
                      )}
                    </div>

                    {withdrawal.status === "pending" && (
                      <div className="flex flex-col sm:flex-row gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            haptics.light();
                            approveMutation.mutate(withdrawal.id);
                          }}
                          disabled={approveMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(withdrawal)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <ArrowDownToLine className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No withdrawal requests found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Withdrawal Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this withdrawal request
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="rejection-reason">Rejection Reason</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Enter reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              haptics.light();
              setShowRejectDialog(false);
              setRejectionReason("");
              setSelectedRequest(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReject}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagerLayout>
  );
}

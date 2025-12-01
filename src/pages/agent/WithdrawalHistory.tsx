import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowDownToLine, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar,
  DollarSign,
  Loader2,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function WithdrawalHistory() {
  const { agentId } = useAuth();
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["agent-withdrawal-history", agentId, filterStatus],
    queryFn: async () => {
      if (!agentId) return [];

      let query = supabase
        .from("withdrawal_requests")
        .select(`
          *,
          approver:profiles!withdrawal_requests_approved_by_fkey(
            full_name
          )
        `)
        .eq("agent_id", agentId)
        .order("requested_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  const pendingCount = withdrawals?.filter(w => w.status === "pending").length || 0;
  const approvedCount = withdrawals?.filter(w => w.status === "approved").length || 0;
  const rejectedCount = withdrawals?.filter(w => w.status === "rejected").length || 0;
  
  const totalRequested = withdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;
  const totalApproved = withdrawals?.filter(w => w.status === "approved")
    .reduce((sum, w) => sum + Number(w.amount), 0) || 0;

  return (
    <AgentLayout>
      <div className="space-y-6 p-6">
          <div>
            <h1 className="text-3xl font-bold text-purple-900 mb-2">Withdrawal History</h1>
            <p className="text-purple-600">Track all your withdrawal requests and their status</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-orange-600 font-medium mb-1">Pending</p>
                    <p className="text-2xl font-bold text-orange-900">{pendingCount}</p>
                  </div>
                  <div className="p-2 bg-orange-100 rounded-full">
                    <Clock className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 font-medium mb-1">Approved</p>
                    <p className="text-2xl font-bold text-green-900">{approvedCount}</p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-full">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-red-600 font-medium mb-1">Rejected</p>
                    <p className="text-2xl font-bold text-red-900">{rejectedCount}</p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-full">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-600 font-medium mb-1">Total Approved</p>
                    <p className="text-lg font-bold text-purple-900">
                      {(totalApproved / 1000).toFixed(0)}K
                    </p>
                  </div>
                  <div className="p-2 bg-purple-100 rounded-full">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              All ({withdrawals?.length || 0})
            </Button>
            <Button
              variant={filterStatus === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("pending")}
            >
              Pending ({pendingCount})
            </Button>
            <Button
              variant={filterStatus === "approved" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("approved")}
            >
              Approved ({approvedCount})
            </Button>
            <Button
              variant={filterStatus === "rejected" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("rejected")}
            >
              Rejected ({rejectedCount})
            </Button>
          </div>

          {/* Withdrawal Requests List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : withdrawals && withdrawals.length > 0 ? (
            <div className="space-y-4">
              {withdrawals.map((withdrawal) => (
                <Card 
                  key={withdrawal.id} 
                  className={`hover:shadow-lg transition-shadow ${
                    withdrawal.status === "pending" 
                      ? "border-l-4 border-l-orange-500" 
                      : withdrawal.status === "approved"
                      ? "border-l-4 border-l-green-500"
                      : "border-l-4 border-l-red-500"
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-full ${
                            withdrawal.status === "pending"
                              ? "bg-orange-100"
                              : withdrawal.status === "approved"
                              ? "bg-green-100"
                              : "bg-red-100"
                          }`}>
                            <ArrowDownToLine className={`h-6 w-6 ${
                              withdrawal.status === "pending"
                                ? "text-orange-600"
                                : withdrawal.status === "approved"
                                ? "text-green-600"
                                : "text-red-600"
                            }`} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Withdrawal Request</p>
                            <p className="text-2xl font-bold text-purple-900">
                              UGX {Number(withdrawal.amount).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            withdrawal.status === "approved"
                              ? "default"
                              : withdrawal.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-sm px-3 py-1"
                        >
                          {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                        </Badge>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Requested Date</p>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-purple-600" />
                            <p className="text-sm font-medium">
                              {format(new Date(withdrawal.requested_at), "MMM d, yyyy")}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(withdrawal.requested_at), "h:mm a")}
                          </p>
                        </div>

                        {withdrawal.approved_at && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {withdrawal.status === "approved" ? "Approved" : "Rejected"} Date
                            </p>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-purple-600" />
                              <p className="text-sm font-medium">
                                {format(new Date(withdrawal.approved_at), "MMM d, yyyy")}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(withdrawal.approved_at), "h:mm a")}
                            </p>
                          </div>
                        )}

                        {withdrawal.approver && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {withdrawal.status === "approved" ? "Approved" : "Rejected"} By
                            </p>
                            <p className="text-sm font-medium">{withdrawal.approver.full_name}</p>
                          </div>
                        )}
                      </div>

                      {/* Rejection Reason */}
                      {withdrawal.status === "rejected" && withdrawal.rejection_reason && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-red-900 mb-1">
                                Rejection Reason
                              </p>
                              <p className="text-sm text-red-700">{withdrawal.rejection_reason}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pending Status Message */}
                      {withdrawal.status === "pending" && (
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Clock className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-orange-900 mb-1">
                                Awaiting Approval
                              </p>
                              <p className="text-sm text-orange-700">
                                Your withdrawal request is pending manager approval. You'll be notified once it's processed.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Approved Success Message */}
                      {withdrawal.status === "approved" && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-green-900 mb-1">
                                Withdrawal Approved
                              </p>
                              <p className="text-sm text-green-700">
                                Your withdrawal has been approved and processed. The amount has been deducted from your wallet.
                              </p>
                            </div>
                          </div>
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
                <h3 className="text-lg font-semibold mb-2">No Withdrawal Requests</h3>
                <p className="text-muted-foreground mb-6">
                  You haven't made any withdrawal requests yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Go to your dashboard to request a withdrawal from your wallet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
    </AgentLayout>
  );
}

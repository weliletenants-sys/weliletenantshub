import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, KeyRound } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Profile {
  full_name: string;
  phone_number: string;
}

interface Agent {
  user_id: string;
  profiles: Profile;
}

interface PasswordChangeRequest {
  id: string;
  agent_id: string;
  reason: string;
  status: string;
  requested_at: string;
  handled_at: string | null;
  handled_by: string | null;
  rejection_reason: string | null;
  agents: Agent;
}

export default function PasswordChangeRequests() {
  const [selectedRequest, setSelectedRequest] = useState<PasswordChangeRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["password-change-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("password_change_requests")
        .select(`
          *,
          agents!password_change_requests_agent_id_fkey(
            user_id,
            profiles!agents_user_id_fkey(full_name, phone_number)
          )
        `)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      return data as any as PasswordChangeRequest[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = requests?.find(r => r.id === requestId);
      if (!request) throw new Error("Request not found");

      // Send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        `${request.agents.profiles.phone_number}@welile.local`,
        { redirectTo: `${window.location.origin}/` }
      );

      if (resetError) throw resetError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update request status
      const { error: updateError } = await supabase
        .from("password_change_requests")
        .update({
          status: "approved",
          handled_at: new Date().toISOString(),
          handled_by: user.id,
        })
        .eq("id", requestId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      haptics.success();
      toast.success("Password reset email sent to agent");
      queryClient.invalidateQueries({ queryKey: ["password-change-requests"] });
    },
    onError: (error: any) => {
      haptics.error();
      console.error("Error approving request:", error);
      toast.error(error.message || "Failed to approve request");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("password_change_requests")
        .update({
          status: "rejected",
          handled_at: new Date().toISOString(),
          handled_by: user.id,
          rejection_reason: reason,
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      toast.success("Request rejected");
      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ["password-change-requests"] });
    },
    onError: (error: any) => {
      haptics.error();
      console.error("Error rejecting request:", error);
      toast.error(error.message || "Failed to reject request");
    },
  });

  const handleReject = () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim() || rejectionReason.length < 10) {
      haptics.error();
      toast.error("Rejection reason must be at least 10 characters");
      return;
    }
    rejectMutation.mutate({ requestId: selectedRequest.id, reason: rejectionReason.trim() });
  };

  const openRejectDialog = (request: PasswordChangeRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const pendingRequests = requests?.filter(r => r.status === "pending") || [];
  const approvedRequests = requests?.filter(r => r.status === "approved") || [];
  const rejectedRequests = requests?.filter(r => r.status === "rejected") || [];

  const RequestCard = ({ request }: { request: PasswordChangeRequest }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {request.agents.profiles.full_name}
            </CardTitle>
            <CardDescription>
              {request.agents.profiles.phone_number}
            </CardDescription>
          </div>
          <Badge
            variant={
              request.status === "pending"
                ? "default"
                : request.status === "approved"
                ? "default"
                : "destructive"
            }
          >
            {request.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
            {request.status === "approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
            {request.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Reason</Label>
          <p className="text-sm mt-1">{request.reason}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Requested {format(new Date(request.requested_at), "MMM d, yyyy 'at' h:mm a")}</span>
        </div>
        {request.status === "rejected" && request.rejection_reason && (
          <div className="pt-2 border-t">
            <Label className="text-xs text-muted-foreground">Rejection Reason</Label>
            <p className="text-sm mt-1 text-destructive">{request.rejection_reason}</p>
          </div>
        )}
        {request.status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => approveMutation.mutate(request.id)}
              disabled={approveMutation.isPending}
              className="flex-1"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Approve & Send Reset Email
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => openRejectDialog(request)}
              disabled={rejectMutation.isPending}
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <ManagerLayout>
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Password Change Requests</h1>
            <p className="text-sm text-muted-foreground">
              Review and approve agent password change requests
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{approvedRequests.length}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{rejectedRequests.length}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({approvedRequests.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({rejectedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : pendingRequests.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No pending requests</CardContent></Card>
            ) : (
              pendingRequests.map(request => <RequestCard key={request.id} request={request} />)
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : approvedRequests.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No approved requests</CardContent></Card>
            ) : (
              approvedRequests.map(request => <RequestCard key={request.id} request={request} />)
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : rejectedRequests.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No rejected requests</CardContent></Card>
            ) : (
              rejectedRequests.map(request => <RequestCard key={request.id} request={request} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Password Change Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request. The agent will see this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="e.g., Please contact support directly for password issues..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
                disabled={rejectMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">Minimum 10 characters required</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason("");
                setSelectedRequest(null);
              }}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim() || rejectionReason.length < 10}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ManagerLayout>
  );
}
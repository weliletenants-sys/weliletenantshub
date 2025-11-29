import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { DollarSign, Send, Users, Calendar } from "lucide-react";

interface AgentSummary {
  agentId: string;
  agentName: string;
  userId: string;
  paymentCount: number;
  totalCommission: number;
  totalAmount: number;
  payments: Array<{
    tenantName: string;
    amount: number;
    commission: number;
  }>;
}

export function ManagerCommissionSummaryDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's manager-recorded payments grouped by agent
  const { data: summaries, isLoading } = useQuery({
    queryKey: ["commission-summaries", today],
    queryFn: async () => {
      const { data: collections, error } = await supabase
        .from("collections")
        .select(`
          agent_id,
          amount,
          commission,
          agents!inner(
            id,
            user_id,
            profiles!inner(full_name)
          ),
          tenants!inner(tenant_name)
        `)
        .eq("created_by_manager", true)
        .eq("status", "verified")
        .eq("collection_date", today);

      if (error) throw error;

      // Group by agent
      const agentMap = new Map<string, AgentSummary>();

      collections?.forEach((col: any) => {
        const agentId = col.agent_id;
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            agentId,
            agentName: col.agents.profiles.full_name || "Unknown Agent",
            userId: col.agents.user_id,
            paymentCount: 0,
            totalCommission: 0,
            totalAmount: 0,
            payments: [],
          });
        }

        const summary = agentMap.get(agentId)!;
        summary.paymentCount++;
        summary.totalCommission += col.commission || 0;
        summary.totalAmount += col.amount || 0;
        summary.payments.push({
          tenantName: col.tenants.tenant_name,
          amount: col.amount,
          commission: col.commission,
        });
      });

      return Array.from(agentMap.values());
    },
    enabled: open,
  });

  // Send notifications mutation
  const sendNotificationsMutation = useMutation({
    mutationFn: async (agentSummaries: AgentSummary[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const notifications = agentSummaries.map((summary) => ({
        sender_id: user.id,
        recipient_id: summary.userId,
        title: "🎯 Daily Commission Summary",
        message: `Great work today! Managers recorded ${summary.paymentCount} payment${summary.paymentCount > 1 ? 's' : ''} on your behalf.

💰 Total Commission Earned Today: UGX ${summary.totalCommission.toLocaleString()}
📊 Total Payments Processed: UGX ${summary.totalAmount.toLocaleString()}
📈 Average Commission per Payment: UGX ${Math.round(summary.totalCommission / summary.paymentCount).toLocaleString()}

${summary.payments.length <= 3 ? '\nPayments:\n' + summary.payments.map(p => `• ${p.tenantName}: UGX ${p.commission.toLocaleString()}`).join('\n') : ''}

Keep up the excellent work! 🚀`,
        priority: "normal",
        read: false,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;

      return notifications.length;
    },
    onSuccess: (count) => {
      toast.success(`Sent ${count} commission ${count === 1 ? 'summary' : 'summaries'}`, {
        description: "Agents have been notified of their daily earnings",
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
    },
    onError: (error) => {
      console.error("Error sending summaries:", error);
      toast.error("Failed to send summaries", {
        description: "Please try again",
      });
    },
  });

  const totalAgents = summaries?.length || 0;
  const totalCommission = summaries?.reduce((sum, s) => sum + s.totalCommission, 0) || 0;
  const totalPayments = summaries?.reduce((sum, s) => sum + s.paymentCount, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Calendar className="mr-2 h-4 w-4" />
          Preview Daily Summaries
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Daily Commission Summary Preview</DialogTitle>
          <DialogDescription>
            Review and send today's commission summaries to agents
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : totalAgents === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No manager-recorded payments today</p>
            <p className="text-sm">Summaries will appear here when payments are recorded</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <Users className="inline h-4 w-4 mr-1" />
                    Agents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalAgents}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <DollarSign className="inline h-4 w-4 mr-1" />
                    Total Commission
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">UGX {totalCommission.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalPayments}</div>
                </CardContent>
              </Card>
            </div>

            {/* Agent Summaries */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {summaries?.map((summary) => (
                  <Card key={summary.agentId} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{summary.agentName}</CardTitle>
                        <Badge variant="secondary">
                          {summary.paymentCount} payment{summary.paymentCount > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Commission:</span>
                        <span className="font-semibold text-primary">
                          UGX {summary.totalCommission.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Amount:</span>
                        <span className="font-semibold">
                          UGX {summary.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg per Payment:</span>
                        <span className="font-semibold">
                          UGX {Math.round(summary.totalCommission / summary.paymentCount).toLocaleString()}
                        </span>
                      </div>
                      
                      {summary.payments.length <= 3 && (
                        <>
                          <Separator className="my-2" />
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground mb-1">Payments:</p>
                            {summary.payments.map((payment, idx) => (
                              <div key={idx} className="text-xs flex justify-between">
                                <span>• {payment.tenantName}</span>
                                <span className="text-primary">
                                  UGX {payment.commission.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Send Button */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => summaries && sendNotificationsMutation.mutate(summaries)}
                disabled={sendNotificationsMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Send to {totalAgents} Agent{totalAgents > 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

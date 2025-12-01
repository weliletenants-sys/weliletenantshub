import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, User, Phone, Calendar, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function TransferHistory() {
  const { data: transfers, isLoading } = useQuery({
    queryKey: ["agent-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_transfers")
        .select(`
          *,
          from_agent:agents!agent_transfers_from_agent_id_fkey(
            id,
            user:profiles!agents_user_id_fkey(
              full_name,
              phone_number
            )
          ),
          to_agent:agents!agent_transfers_to_agent_id_fkey(
            id,
            user:profiles!agents_user_id_fkey(
              full_name,
              phone_number
            )
          )
        `)
        .order("transferred_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const totalTransfers = transfers?.length || 0;
  const totalAmount = transfers?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const completedTransfers = transfers?.filter(t => t.status === "completed").length || 0;

  return (
    <ManagerLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-purple-900 mb-2">Agent Transfer History</h1>
          <p className="text-purple-600">View all money transfers between agents</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Transfers</p>
                  <p className="text-3xl font-bold text-blue-900">{totalTransfers}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Completed</p>
                  <p className="text-3xl font-bold text-green-900">{completedTransfers}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <ArrowRightLeft className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Total Amount</p>
                  <p className="text-2xl font-bold text-purple-900">
                    UGX {totalAmount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <ArrowRightLeft className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transfer History */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : transfers && transfers.length > 0 ? (
          <div className="space-y-4">
            {transfers.map((transfer) => (
              <Card key={transfer.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        {/* Sender */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-red-600" />
                            <span className="font-semibold text-gray-900">
                              {transfer.from_agent.user.full_name || "Unknown"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{transfer.from_agent.user.phone_number}</span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="p-2 bg-purple-100 rounded-full">
                          <ArrowRight className="h-5 w-5 text-purple-600" />
                        </div>

                        {/* Recipient */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-gray-900">
                              {transfer.to_agent.user.full_name || "Unknown"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{transfer.to_agent.user.phone_number}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Amount Transferred</p>
                          <p className="text-lg font-bold text-purple-900">
                            UGX {Number(transfer.amount).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <p className="text-sm">
                              {format(new Date(transfer.transferred_at), "MMM d, yyyy HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge
                            variant={transfer.status === "completed" ? "default" : "destructive"}
                          >
                            {transfer.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No transfers found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ManagerLayout>
  );
}

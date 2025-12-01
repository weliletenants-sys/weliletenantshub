import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Save, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface LegacyPayment {
  id: string;
  payment_id: string;
  amount: number;
  collection_date: string;
  payment_method: string;
  status: string;
  created_at: string;
  tenant: {
    tenant_name: string;
    tenant_phone: string;
  };
  agent: {
    profiles: {
      full_name: string;
    };
  };
}

interface EditingTid {
  id: string;
  newTid: string;
  validationError?: string;
}

export default function TIDValidation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTids, setEditingTids] = useState<Record<string, EditingTid>>({});
  const queryClient = useQueryClient();

  // Fetch all payments with legacy TIDs or potential issues
  const { data: legacyPayments, isLoading, refetch } = useQuery({
    queryKey: ["legacy-tids", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("collections")
        .select(`
          id,
          payment_id,
          amount,
          collection_date,
          payment_method,
          status,
          created_at,
          tenants!collections_tenant_id_fkey(tenant_name, tenant_phone),
          agents!collections_agent_id_fkey(
            profiles!agents_user_id_fkey(full_name)
          )
        `)
        .or(`payment_id.ilike.LEGACY-%,payment_id.eq.`)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`payment_id.ilike.%${searchQuery}%,tenants.tenant_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map((record: any) => ({
        id: record.id,
        payment_id: record.payment_id,
        amount: record.amount,
        collection_date: record.collection_date,
        payment_method: record.payment_method,
        status: record.status,
        created_at: record.created_at,
        tenant: record.tenants,
        agent: record.agents,
      })) as LegacyPayment[];
    },
  });

  // Validate TID format
  const validateTidFormat = (tid: string, method: string): string => {
    if (!tid || tid.trim().length === 0) {
      return "Transaction ID cannot be empty";
    }

    if (tid.startsWith("LEGACY-")) {
      return "Must replace LEGACY placeholder with actual TID";
    }

    if (method === "mtn") {
      const mtnPattern = /^MTN-\d{5}$/;
      if (!mtnPattern.test(tid)) {
        return "MTN format: MTN-XXXXX (e.g., MTN-12345)";
      }
    } else if (method === "airtel") {
      const airtelPattern = /^ATL-\d{5}$/;
      if (!airtelPattern.test(tid)) {
        return "Airtel format: ATL-XXXXX (e.g., ATL-12345)";
      }
    }

    return "";
  };

  // Check for duplicate TID
  const checkDuplicateTid = async (newTid: string, excludeId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("collections")
      .select("id")
      .eq("payment_id", newTid)
      .neq("id", excludeId)
      .maybeSingle();

    return !!data;
  };

  // Update editing state
  const handleTidChange = (paymentId: string, newTid: string, paymentMethod: string) => {
    const validationError = validateTidFormat(newTid, paymentMethod);
    setEditingTids(prev => ({
      ...prev,
      [paymentId]: {
        id: paymentId,
        newTid,
        validationError,
      },
    }));
  };

  // Update TID mutation
  const updateTidMutation = useMutation({
    mutationFn: async ({ paymentId, newTid }: { paymentId: string; newTid: string }) => {
      const { error } = await supabase
        .from("collections")
        .update({ payment_id: newTid.trim() })
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legacy-tids"] });
      queryClient.invalidateQueries({ queryKey: ["tid-history"] });
      toast.success("Transaction ID updated successfully");
    },
    onError: (error) => {
      console.error("Error updating TID:", error);
      toast.error("Failed to update Transaction ID");
    },
  });

  // Save individual TID
  const handleSaveTid = async (payment: LegacyPayment) => {
    const editing = editingTids[payment.id];
    if (!editing) return;

    // Validate format
    if (editing.validationError) {
      toast.error(editing.validationError);
      return;
    }

    // Check for duplicates
    const isDuplicate = await checkDuplicateTid(editing.newTid, payment.id);
    if (isDuplicate) {
      toast.error("This Transaction ID already exists. Please use a unique TID.");
      return;
    }

    updateTidMutation.mutate({
      paymentId: payment.id,
      newTid: editing.newTid,
    });

    // Clear editing state
    setEditingTids(prev => {
      const updated = { ...prev };
      delete updated[payment.id];
      return updated;
    });
  };

  const totalLegacy = legacyPayments?.length || 0;
  const totalEditing = Object.keys(editingTids).length;
  const totalWithErrors = Object.values(editingTids).filter(e => e.validationError).length;

  return (
    <ManagerLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">TID Validation & Audit</h1>
          <p className="text-muted-foreground mt-1">
            Identify and fix legacy Transaction IDs and validation issues
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Legacy TIDs Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{totalLegacy}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requiring validation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Currently Editing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEditing}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Unsaved changes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Validation Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{totalWithErrors}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Format issues
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Compliance Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {totalLegacy === 0 ? "100" : "0"}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Valid TIDs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by TID or tenant name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Validation Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Legacy & Invalid Transaction IDs
            </CardTitle>
            <CardDescription>
              Update placeholder TIDs with actual transaction IDs from payment records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading legacy TIDs...
              </div>
            ) : legacyPayments && legacyPayments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Current TID</TableHead>
                      <TableHead>New TID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {legacyPayments.map((payment) => {
                      const editing = editingTids[payment.id];
                      const isEditing = !!editing;
                      const hasError = editing?.validationError;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <Badge variant="destructive" className="font-mono">
                              {payment.payment_id}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2 min-w-[200px]">
                              <Input
                                placeholder={
                                  payment.payment_method === "cash"
                                    ? "Enter TID"
                                    : payment.payment_method === "mtn"
                                    ? "MTN-12345"
                                    : "ATL-12345"
                                }
                                value={editing?.newTid || ""}
                                onChange={(e) =>
                                  handleTidChange(payment.id, e.target.value, payment.payment_method)
                                }
                                className={cn(
                                  hasError && "border-destructive focus-visible:ring-destructive"
                                )}
                              />
                              {hasError && (
                                <div className="flex items-start gap-2 text-xs text-destructive">
                                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  {editing.validationError}
                                </div>
                              )}
                              {isEditing && !hasError && editing.newTid && (
                                <div className="flex items-center gap-2 text-xs text-green-600">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Valid format
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            UGX {payment.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{payment.tenant.tenant_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {payment.tenant.tenant_phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {payment.agent.profiles.full_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {payment.payment_method.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(payment.collection_date), "PPP")}
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => handleSaveTid(payment)}
                              disabled={!isEditing || !!hasError || updateTidMutation.isPending}
                              size="sm"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-semibold">All TIDs are valid!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No legacy or invalid Transaction IDs found
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}

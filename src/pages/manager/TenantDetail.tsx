import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, User, Phone, DollarSign, Calendar, Edit, Save, Trash2, Home, MapPin, FileText, CalendarDays, History, TrendingDown, UserCog, ArrowRightLeft, Download, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { haptics } from "@/utils/haptics";
import { useRealtimeAllTenants, useRealtimeAllCollections, registerSyncCallback } from "@/hooks/useRealtimeSubscription";
import { useOptimisticTenantDeletion } from "@/hooks/useOptimisticTenant";

interface TenantData {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  landlord_name: string | null;
  landlord_phone: string | null;
  lc1_name: string | null;
  lc1_phone: string | null;
  rent_amount: number;
  outstanding_balance: number;
  daily_payment_amount: number | null;
  registration_fee: number | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  days_remaining: number;
  last_payment_date: string | null;
  next_payment_date: string | null;
  created_at: string;
  agent_id: string;
  agents?: {
    profiles: {
      full_name: string;
      phone_number: string;
    };
  };
}

interface Collection {
  id: string;
  amount: number;
  commission: number;
  payment_method: string;
  collection_date: string;
  status: string;
}

interface TransferHistory {
  id: string;
  created_at: string;
  old_data: any;
  new_data: any;
  manager?: {
    full_name: string;
    phone_number: string;
  };
}

const ManagerTenantDetail = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  
  // Optimistic mutations
  const deleteTenantMutation = useOptimisticTenantDeletion();
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [editForm, setEditForm] = useState({
    tenantName: "",
    tenantPhone: "",
    landlordName: "",
    landlordPhone: "",
    lc1Name: "",
    lc1Phone: "",
    rentAmount: "",
    outstandingBalance: "",
    registrationFee: "",
    status: "",
    startDate: "",
    dueDate: "",
  });

  // Enable real-time updates
  useRealtimeAllTenants();
  useRealtimeAllCollections();

  const fetchTenantData = async () => {
    try {
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select(`
          *,
          agents (
            profiles!agents_user_id_fkey (
              full_name,
              phone_number
            )
          )
        `)
        .eq("id", tenantId)
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (!tenantData) {
        toast.error("Tenant not found");
        navigate("/manager/dashboard");
        return;
      }

      setTenant(tenantData);
      setEditForm({
        tenantName: tenantData.tenant_name,
        tenantPhone: tenantData.tenant_phone,
        landlordName: tenantData.landlord_name || "",
        landlordPhone: tenantData.landlord_phone || "",
        lc1Name: tenantData.lc1_name || "",
        lc1Phone: tenantData.lc1_phone || "",
        rentAmount: tenantData.rent_amount?.toString() || "",
        outstandingBalance: tenantData.outstanding_balance?.toString() || "",
        registrationFee: tenantData.registration_fee?.toString() || "",
        status: tenantData.status || "pending",
        startDate: tenantData.start_date || "",
        dueDate: tenantData.due_date || "",
      });

      // Fetch payment history
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("collections")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("collection_date", { ascending: false });

      if (collectionsError) throw collectionsError;
      setCollections(collectionsData || []);

      // Fetch transfer history from audit logs
      const { data: auditData, error: auditError } = await supabase
        .from("audit_logs")
        .select(`
          id,
          created_at,
          old_data,
          new_data,
          user_id
        `)
        .eq("table_name", "tenants")
        .eq("record_id", tenantId)
        .eq("action", "TRANSFER")
        .order("created_at", { ascending: false });

      if (auditError) {
        console.error("Error fetching transfer history:", auditError);
      } else if (auditData) {
        // Fetch manager details for each transfer
        const transfersWithManagers = await Promise.all(
          auditData.map(async (audit) => {
            const { data: managerProfile } = await supabase
              .from("profiles")
              .select("full_name, phone_number")
              .eq("id", audit.user_id)
              .single();

            return {
              ...audit,
              manager: managerProfile,
            };
          })
        );
        setTransferHistory(transfersWithManagers);
      }
    } catch (error: any) {
      console.error("Error fetching tenant:", error);
      toast.error("Failed to load tenant details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
    fetchAvailableAgents();

    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'tenants' || table === 'collections') {
        console.log(`Real-time update detected on ${table}, refreshing tenant details`);
        fetchTenantData();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, [tenantId]);

  const fetchAvailableAgents = async () => {
    try {
      const { data: agentsData, error } = await supabase
        .from("agents")
        .select(`
          id,
          profiles:user_id (
            full_name,
            phone_number
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAvailableAgents(agentsData || []);
    } catch (error: any) {
      console.error("Error fetching agents:", error);
    }
  };

  const handleSave = async () => {
    if (!tenant) return;

    try {
      setIsSaving(true);

      const rentAmount = parseFloat(editForm.rentAmount) || 0;
      const startDate = editForm.startDate;
      const dueDate = editForm.dueDate;

      let dailyPaymentAmount = null;
      if (rentAmount > 0 && startDate && dueDate) {
        const start = new Date(startDate);
        const due = new Date(dueDate);
        const daysDiff = Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) {
          dailyPaymentAmount = rentAmount / daysDiff;
        }
      }

      const { error } = await supabase
        .from("tenants")
        .update({
          tenant_name: editForm.tenantName,
          tenant_phone: editForm.tenantPhone,
          landlord_name: editForm.landlordName || null,
          landlord_phone: editForm.landlordPhone || null,
          lc1_name: editForm.lc1Name || null,
          lc1_phone: editForm.lc1Phone || null,
          rent_amount: rentAmount,
          outstanding_balance: parseFloat(editForm.outstandingBalance) || 0,
          registration_fee: parseFloat(editForm.registrationFee) || 0,
          status: editForm.status,
          start_date: startDate || null,
          due_date: dueDate || null,
          daily_payment_amount: dailyPaymentAmount,
        })
        .eq("id", tenantId);

      if (error) throw error;

      haptics.success();
      toast.success("Tenant updated successfully");
      setIsEditing(false);
      await fetchTenantData();
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      haptics.error();
      toast.error("Failed to update tenant");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tenant || !tenantId) return;

    try {
      // Get current user for audit log
      const { data: { user } } = await supabase.auth.getUser();
      
      await deleteTenantMutation.mutateAsync({
        tenantId,
        tenantName: tenant.tenant_name,
        agentId: tenant.agent_id,
        deletionReason: deleteReason,
        managerId: user?.id
      });

      navigate("/manager/dashboard");
    } catch (error: any) {
      console.error("Error deleting tenant:", error);
    }
  };

  const handleTransferTenant = async () => {
    if (!tenant || !selectedAgentId) return;

    try {
      setIsTransferring(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      // Get the new agent's profile info for the audit log
      const { data: newAgent } = await supabase
        .from("agents")
        .select(`
          id,
          profiles!agents_user_id_fkey (
            full_name
          )
        `)
        .eq("id", selectedAgentId)
        .single();

      // Get the old agent's profile info for the audit log
      const { data: oldAgent } = await supabase
        .from("agents")
        .select(`
          id,
          profiles!agents_user_id_fkey (
            full_name
          )
        `)
        .eq("id", tenant.agent_id)
        .single();

      // Update the tenant's agent_id
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ agent_id: selectedAgentId })
        .eq("id", tenantId);

      if (updateError) throw updateError;

      // Create audit log entry for the transfer
      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          user_id: user.id,
          action: "TRANSFER",
          table_name: "tenants",
          record_id: tenantId!,
          old_data: {
            agent_id: tenant.agent_id,
            agent_name: oldAgent?.profiles?.full_name || "Unknown",
          },
          new_data: {
            agent_id: selectedAgentId,
            agent_name: newAgent?.profiles?.full_name || "Unknown",
          },
          changed_fields: ["agent_id"],
        });

      if (auditError) {
        console.error("Error creating audit log:", auditError);
        // Don't fail the transfer if audit log fails, just log it
      }

      haptics.success();
      toast.success(`Tenant transferred to ${newAgent?.profiles?.full_name || "new agent"} successfully`);
      setTransferDialogOpen(false);
      setSelectedAgentId("");
      await fetchTenantData();
    } catch (error: any) {
      console.error("Error transferring tenant:", error);
      haptics.error();
      toast.error("Failed to transfer tenant");
    } finally {
      setIsTransferring(false);
    }
  };

  const calculateDailyPayment = () => {
    const rent = parseFloat(editForm.rentAmount) || 0;
    const start = editForm.startDate ? new Date(editForm.startDate) : null;
    const due = editForm.dueDate ? new Date(editForm.dueDate) : null;

    if (rent > 0 && start && due && due > start) {
      const daysDiff = Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return (rent / daysDiff).toFixed(0);
    }
    return "0";
  };

  const exportTransferHistoryCSV = () => {
    if (!tenant || transferHistory.length === 0) return;

    const headers = ["Transfer #", "Date", "Time", "From Agent", "To Agent", "Approved By", "Manager Phone"];
    const rows = transferHistory.map((transfer, index) => [
      `#${transferHistory.length - index}`,
      format(new Date(transfer.created_at), "MMM d, yyyy"),
      format(new Date(transfer.created_at), "h:mm a"),
      transfer.old_data?.agent_name || "Unknown",
      transfer.new_data?.agent_name || "Unknown",
      transfer.manager?.full_name || "Unknown",
      transfer.manager?.phone_number || "N/A",
    ]);

    const csvContent = [
      `Transfer History for ${tenant.tenant_name}`,
      `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
      "",
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `transfer-history-${tenant.tenant_name.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    haptics.success();
    toast.success("Transfer history exported as CSV");
  };

  const exportTransferHistoryPDF = () => {
    if (!tenant || transferHistory.length === 0) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Transfer History Report", 14, 20);
    
    // Tenant info
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Tenant: ${tenant.tenant_name}`, 14, 30);
    doc.text(`Phone: ${tenant.tenant_phone}`, 14, 37);
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`, 14, 44);
    
    // Line separator
    doc.setLineWidth(0.5);
    doc.line(14, 48, 196, 48);
    
    // Table headers
    let yPosition = 58;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("#", 14, yPosition);
    doc.text("Date & Time", 25, yPosition);
    doc.text("From Agent", 70, yPosition);
    doc.text("To Agent", 115, yPosition);
    doc.text("Approved By", 160, yPosition);
    
    // Table rows
    doc.setFont("helvetica", "normal");
    transferHistory.forEach((transfer, index) => {
      yPosition += 10;
      
      // Check if we need a new page
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      
      const transferNum = `${transferHistory.length - index}`;
      const dateTime = format(new Date(transfer.created_at), "MMM d, yyyy h:mm a");
      const fromAgent = transfer.old_data?.agent_name || "Unknown";
      const toAgent = transfer.new_data?.agent_name || "Unknown";
      const approvedBy = transfer.manager?.full_name || "Unknown";
      
      doc.text(transferNum, 14, yPosition);
      doc.text(dateTime, 25, yPosition);
      doc.text(fromAgent.substring(0, 20), 70, yPosition);
      doc.text(toAgent.substring(0, 20), 115, yPosition);
      doc.text(approvedBy.substring(0, 18), 160, yPosition);
      
      // Add manager phone if available
      if (transfer.manager?.phone_number) {
        yPosition += 5;
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(transfer.manager.phone_number, 160, yPosition);
        doc.setFontSize(10);
        doc.setTextColor(0);
        yPosition += 2;
      }
    });
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, 14, 290);
      doc.text("Welile Rent Management System", 105, 290, { align: "center" });
    }
    
    doc.save(`transfer-history-${tenant.tenant_name.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    
    haptics.success();
    toast.success("Transfer history exported as PDF");
  };

  if (loading) {
    return (
      <ManagerLayout currentPage="/manager/dashboard">
        <div className="text-center py-8">Loading tenant details...</div>
      </ManagerLayout>
    );
  }

  if (!tenant) {
    return (
      <ManagerLayout currentPage="/manager/dashboard">
        <div className="text-center py-8">Tenant not found</div>
      </ManagerLayout>
    );
  }

  const totalPaid = collections
    .filter(c => c.status === "verified")
    .reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0);

  return (
    <ManagerLayout currentPage="/manager/dashboard">
      <div className="space-y-6 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{tenant.tenant_name}</h1>
              <p className="text-muted-foreground">
                Managed by {tenant.agents?.profiles?.full_name || 'Unknown Agent'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="lg">
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Transfer Tenant
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Transfer Tenant to Another Agent</DialogTitle>
                      <DialogDescription>
                        Select an agent to transfer {tenant.tenant_name} to. This action will be recorded in the audit log.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="agent">Select Agent</Label>
                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an agent" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAgents
                              .filter(agent => agent.id !== tenant.agent_id)
                              .map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  <div className="flex items-center gap-2">
                                    <UserCog className="h-4 w-4" />
                                    <span>{agent.profiles?.full_name || "Unknown Agent"}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({agent.profiles?.phone_number})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-4 bg-muted rounded-lg border">
                        <p className="text-sm text-muted-foreground">
                          <strong>Current Agent:</strong> {tenant.agents?.profiles?.full_name || "Unknown"}
                        </p>
                        {selectedAgentId && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <strong>New Agent:</strong>{" "}
                            {availableAgents.find(a => a.id === selectedAgentId)?.profiles?.full_name || "Unknown"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => {
                        setTransferDialogOpen(false);
                        setSelectedAgentId("");
                      }}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleTransferTenant}
                        disabled={!selectedAgentId || isTransferring}
                      >
                        {isTransferring ? "Transferring..." : "Transfer Tenant"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button onClick={() => setIsEditing(true)} size="lg">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Details
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="lg"
                      onClick={() => {
                        setDeleteConfirmText("");
                        setDeleteReason("");
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-4">
                        <div>
                          Are you sure you want to delete this tenant? This action cannot be undone and will also delete all payment records.
                        </div>
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="delete-reason-tenant" className="text-sm font-medium text-destructive">
                            Reason for deletion (required): *
                          </Label>
                          <Textarea
                            id="delete-reason-tenant"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            placeholder="Explain why you are deleting this tenant..."
                            className="min-h-[80px] resize-none"
                            disabled={deleteTenantMutation.isPending}
                          />
                          <p className="text-xs text-muted-foreground">
                            This will be recorded in the audit log for accountability.
                          </p>
                        </div>
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="delete-confirm-tenant" className="text-sm font-medium">
                            Type <span className="font-bold text-destructive">{tenant.tenant_name}</span> to confirm deletion:
                          </Label>
                          <Input
                            id="delete-confirm-tenant"
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Enter tenant name"
                            className="font-mono"
                            disabled={deleteTenantMutation.isPending}
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => {
                        setDeleteConfirmText("");
                        setDeleteReason("");
                      }}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleteTenantMutation.isPending || deleteConfirmText !== tenant.tenant_name || deleteReason.trim().length < 10}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteTenantMutation.isPending ? "Deleting..." : "Delete Tenant"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                <Button onClick={handleSave} disabled={isSaving} size="lg">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsEditing(false);
                  fetchTenantData();
                }} size="lg">
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge variant={
                  tenant.status === 'verified' || tenant.status === 'paying' ? 'default' :
                  tenant.status === 'late' ? 'destructive' :
                  'secondary'
                } className="text-base px-4 py-1">
                  {tenant.status}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Days Remaining</p>
                <p className="text-2xl font-bold">{tenant.days_remaining} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Rent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">UGX {parseFloat(tenant.rent_amount?.toString() || '0').toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                UGX {parseFloat(tenant.outstanding_balance?.toString() || '0').toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                UGX {totalPaid.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenant Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Tenant Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="tenantName">Tenant Name *</Label>
                  <Input
                    id="tenantName"
                    value={editForm.tenantName}
                    onChange={(e) => setEditForm({ ...editForm, tenantName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="tenantPhone">Phone Number *</Label>
                  <Input
                    id="tenantPhone"
                    value={editForm.tenantPhone}
                    onChange={(e) => setEditForm({ ...editForm, tenantPhone: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Tenant Name</p>
                  <p className="text-lg font-medium">{tenant.tenant_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="text-lg font-medium">{tenant.tenant_phone}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Landlord Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Landlord Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="landlordName">Landlord Name</Label>
                  <Input
                    id="landlordName"
                    value={editForm.landlordName}
                    onChange={(e) => setEditForm({ ...editForm, landlordName: e.target.value })}
                    placeholder="Enter landlord name"
                  />
                </div>
                <div>
                  <Label htmlFor="landlordPhone">Landlord Phone</Label>
                  <Input
                    id="landlordPhone"
                    value={editForm.landlordPhone}
                    onChange={(e) => setEditForm({ ...editForm, landlordPhone: e.target.value })}
                    placeholder="Enter landlord phone"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Landlord Name</p>
                  <p className="text-lg font-medium">{tenant.landlord_name || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Landlord Phone</p>
                  <p className="text-lg font-medium">{tenant.landlord_phone || "Not set"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* LC1 Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              LC1 Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="lc1Name">LC1 Name</Label>
                  <Input
                    id="lc1Name"
                    value={editForm.lc1Name}
                    onChange={(e) => setEditForm({ ...editForm, lc1Name: e.target.value })}
                    placeholder="Enter LC1 name"
                  />
                </div>
                <div>
                  <Label htmlFor="lc1Phone">LC1 Phone</Label>
                  <Input
                    id="lc1Phone"
                    value={editForm.lc1Phone}
                    onChange={(e) => setEditForm({ ...editForm, lc1Phone: e.target.value })}
                    placeholder="Enter LC1 phone"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">LC1 Name</p>
                  <p className="text-lg font-medium">{tenant.lc1_name || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">LC1 Phone</p>
                  <p className="text-lg font-medium">{tenant.lc1_phone || "Not set"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="rentAmount">Monthly Rent (UGX)</Label>
                  <Input
                    id="rentAmount"
                    type="number"
                    value={editForm.rentAmount}
                    onChange={(e) => setEditForm({ ...editForm, rentAmount: e.target.value })}
                    placeholder="Enter rent amount"
                  />
                </div>
                <div>
                  <Label htmlFor="outstandingBalance">Outstanding Balance (UGX)</Label>
                  <Input
                    id="outstandingBalance"
                    type="number"
                    value={editForm.outstandingBalance}
                    onChange={(e) => setEditForm({ ...editForm, outstandingBalance: e.target.value })}
                    placeholder="Enter balance"
                  />
                </div>
                <div>
                  <Label htmlFor="registrationFee">Registration Fee (UGX)</Label>
                  <Input
                    id="registrationFee"
                    type="number"
                    value={editForm.registrationFee}
                    onChange={(e) => setEditForm({ ...editForm, registrationFee: e.target.value })}
                    placeholder="Enter registration fee"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Rent</p>
                  <p className="text-lg font-medium">UGX {parseFloat(tenant.rent_amount?.toString() || '0').toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className="text-lg font-medium text-destructive">
                    UGX {parseFloat(tenant.outstanding_balance?.toString() || '0').toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Registration Fee</p>
                  <p className="text-lg font-medium">
                    UGX {parseFloat(tenant.registration_fee?.toString() || '0').toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rent Period & Daily Installment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Rent Period & Daily Installment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="paying">Paying</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="defaulted">Defaulted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editForm.startDate && editForm.dueDate && editForm.rentAmount && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Calculated Daily Payment</p>
                    <p className="text-2xl font-bold text-primary">UGX {calculateDailyPayment()}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="text-lg font-medium">
                      {tenant.start_date ? format(new Date(tenant.start_date), "MMM d, yyyy") : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="text-lg font-medium">
                      {tenant.due_date ? format(new Date(tenant.due_date), "MMM d, yyyy") : "Not set"}
                    </p>
                  </div>
                </div>
                {tenant.daily_payment_amount && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Daily Payment Installment</p>
                    <p className="text-2xl font-bold text-primary">
                      UGX {parseFloat(tenant.daily_payment_amount.toString()).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on rent period from {tenant.start_date ? format(new Date(tenant.start_date), "MMM d") : "N/A"} to {tenant.due_date ? format(new Date(tenant.due_date), "MMM d") : "N/A"}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Payment History ({collections.length})
            </CardTitle>
            <CardDescription>
              Total verified: UGX {totalPaid.toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No payment records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    collections.map((collection) => (
                      <TableRow key={collection.id}>
                        <TableCell>
                          {format(new Date(collection.collection_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-semibold">
                          UGX {parseFloat(collection.amount.toString()).toLocaleString()}
                        </TableCell>
                        <TableCell className="capitalize">
                          {collection.payment_method?.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-primary font-medium">
                          UGX {parseFloat(collection.commission.toString()).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            collection.status === 'verified' ? 'default' :
                            collection.status === 'rejected' ? 'destructive' :
                            'secondary'
                          }>
                            {collection.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Transfer History */}
        {transferHistory.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-primary" />
                    Transfer History ({transferHistory.length})
                  </CardTitle>
                  <CardDescription>
                    Complete history of tenant reassignments between agents
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTransferHistoryCSV}
                    className="gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportTransferHistoryPDF}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transferHistory.map((transfer, index) => (
                  <div 
                    key={transfer.id}
                    className="p-4 rounded-lg border bg-card space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Transfer #{transferHistory.length - index}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(transfer.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 p-3 rounded-md bg-muted/50 border">
                        <p className="text-xs text-muted-foreground mb-1">From Agent</p>
                        <p className="font-medium">{transfer.old_data?.agent_name || "Unknown Agent"}</p>
                      </div>
                      
                      <div className="flex items-center justify-center">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                      </div>
                      
                      <div className="flex-1 p-3 rounded-md bg-primary/10 border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">To Agent</p>
                        <p className="font-medium text-primary">{transfer.new_data?.agent_name || "Unknown Agent"}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border">
                      <div className="flex items-center gap-2 text-sm">
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Approved by:</span>
                        <span className="font-medium">
                          {transfer.manager?.full_name || "Unknown Manager"}
                        </span>
                        {transfer.manager?.phone_number && (
                          <span className="text-xs text-muted-foreground">
                            ({transfer.manager.phone_number})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ManagerLayout>
  );
};

export default ManagerTenantDetail;

import { useEffect, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Phone, Calendar, User, Search, Filter, Download, FileText, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeAllTenants, registerSyncCallback } from "@/hooks/useRealtimeSubscription";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow, format } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface VerificationRecord {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  landlord_name: string;
  landlord_phone: string;
  lc1_name: string;
  lc1_phone: string;
  rent_amount: number;
  status: string;
  verified_at: string | null;
  created_at: string;
  agent_id: string;
  agents?: {
    profiles?: {
      full_name: string;
      phone_number: string;
    };
  };
  verifier?: {
    full_name: string;
    phone_number: string;
  };
}

const ManagerVerificationHistory = () => {
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [filteredVerifications, setFilteredVerifications] = useState<VerificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "rejected">("all");
  
  // Enable real-time updates
  useRealtimeAllTenants();

  const fetchVerificationHistory = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          agents (
            profiles:user_id (
              full_name,
              phone_number
            )
          )
        `)
        .in("status", ["verified", "rejected"])
        .not("verified_at", "is", null)
        .order("verified_at", { ascending: false });

      if (error) throw error;

      // Fetch verifier information for each record
      const recordsWithVerifiers = await Promise.all(
        (data || []).map(async (record: any) => {
          if (record.verified_at) {
            // Get verifier from audit logs
            const { data: auditLog } = await supabase
              .from("audit_logs")
              .select(`
                user_id,
                profiles:user_id (
                  full_name,
                  phone_number
                )
              `)
              .eq("table_name", "tenants")
              .eq("record_id", record.id)
              .eq("action", "UPDATE")
              .contains("changed_fields", ["status"])
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            return {
              ...record,
              verifier: auditLog?.profiles || null
            };
          }
          return record;
        })
      );

      setVerifications(recordsWithVerifiers);
      setFilteredVerifications(recordsWithVerifiers);
    } catch (error) {
      console.error("Error fetching verification history:", error);
      toast.error("Failed to load verification history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationHistory();

    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'tenants') {
        console.log(`Real-time update detected on ${table}, refreshing verification history`);
        fetchVerificationHistory();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, []);

  // Filter verifications based on search and status
  useEffect(() => {
    let filtered = verifications;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.tenant_name.toLowerCase().includes(query) ||
        v.tenant_phone.includes(query) ||
        v.agents?.profiles?.full_name?.toLowerCase().includes(query) ||
        v.verifier?.full_name?.toLowerCase().includes(query)
      );
    }

    setFilteredVerifications(filtered);
  }, [searchQuery, statusFilter, verifications]);

  const getStatusBadge = (status: string) => {
    if (status === "verified") {
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Rejected
      </Badge>
    );
  };

  const verifiedCount = verifications.filter(v => v.status === "verified").length;
  const rejectedCount = verifications.filter(v => v.status === "rejected").length;

  // Export to CSV
  const exportToCSV = () => {
    try {
      // Prepare CSV headers
      const headers = [
        "Tenant Name",
        "Tenant Phone",
        "Landlord Name",
        "Landlord Phone",
        "LC1 Name",
        "LC1 Phone",
        "Rent Amount",
        "Status",
        "Agent Name",
        "Verified/Rejected By",
        "Submitted Date",
        "Verification Date"
      ];

      // Prepare CSV rows
      const rows = filteredVerifications.map(record => [
        record.tenant_name,
        record.tenant_phone,
        record.landlord_name || "N/A",
        record.landlord_phone || "N/A",
        record.lc1_name || "N/A",
        record.lc1_phone || "N/A",
        record.rent_amount.toString(),
        record.status.toUpperCase(),
        record.agents?.profiles?.full_name || "Unknown",
        record.verifier?.full_name || "N/A",
        format(new Date(record.created_at), "yyyy-MM-dd HH:mm"),
        record.verified_at ? format(new Date(record.verified_at), "yyyy-MM-dd HH:mm") : "N/A"
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `tenant_verification_history_${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      toast.error("Failed to export CSV");
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Add header with purple background
      doc.setFillColor(107, 45, 197); // #6B2DC5
      doc.rect(0, 0, 210, 30, "F");
      
      // Add Welile logo text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Welile", 14, 20);
      
      // Add title
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text("Tenant Verification History", 14, 45);
      
      // Add export date
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${format(new Date(), "MMMM dd, yyyy HH:mm")}`, 14, 52);
      
      // Add summary stats
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Records: ${filteredVerifications.length}`, 14, 60);
      doc.text(`Verified: ${verifiedCount}`, 60, 60);
      doc.text(`Rejected: ${rejectedCount}`, 100, 60);
      
      // Prepare table data
      const tableData = filteredVerifications.map(record => [
        record.tenant_name,
        record.tenant_phone,
        `UGX ${record.rent_amount.toLocaleString()}`,
        record.status.toUpperCase(),
        record.agents?.profiles?.full_name || "Unknown",
        record.verifier?.full_name || "N/A",
        format(new Date(record.created_at), "MMM dd, yyyy"),
        record.verified_at ? format(new Date(record.verified_at), "MMM dd, yyyy") : "N/A"
      ]);

      // Add table
      (doc as any).autoTable({
        startY: 68,
        head: [["Tenant", "Phone", "Rent", "Status", "Agent", "Verified By", "Submitted", "Verified"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [107, 45, 197],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 22 },
          2: { cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 20 },
          7: { cellWidth: 20 }
        },
        margin: { left: 14, right: 14 }
      });

      // Save PDF
      doc.save(`tenant_verification_history_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <ManagerLayout currentPage="/manager/verification-history">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tenant Verification History</h1>
          <p className="text-muted-foreground">Complete history of all tenant verifications</p>
        </div>

        {/* Summary Stats and Export Buttons */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredVerifications.length === 0}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={exportToPDF}
              disabled={filteredVerifications.length === 0}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{verifications.length}</div>
                <p className="text-sm text-muted-foreground">Total Processed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-success">{verifiedCount}</div>
                <p className="text-sm text-muted-foreground">Verified</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-destructive">{rejectedCount}</div>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tenant name, phone, agent, or manager..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>

            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">
                  All ({verifications.length})
                </TabsTrigger>
                <TabsTrigger value="verified">
                  Verified ({verifiedCount})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({rejectedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Verification Records */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading verification history...</p>
            </CardContent>
          </Card>
        ) : filteredVerifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No records found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" 
                  ? "Try adjusting your search or filters"
                  : "No verification history yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVerifications.map((record) => (
              <Card key={record.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{record.tenant_name}</CardTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {record.tenant_phone}
                      </p>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Tenant Details */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Landlord</p>
                        <p className="font-medium">{record.landlord_name}</p>
                        <p className="text-sm flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {record.landlord_phone}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">LC1 Official</p>
                        <p className="font-medium">{record.lc1_name}</p>
                        <p className="text-sm flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {record.lc1_phone}
                        </p>
                      </div>
                    </div>

                    {/* Financial & Verification Info */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Monthly Rent</p>
                        <p className="font-bold text-lg">
                          UGX {record.rent_amount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Agent</p>
                        <p className="font-medium flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {record.agents?.profiles?.full_name || 'Unknown'}
                        </p>
                      </div>
                      {record.verifier && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {record.status === "verified" ? "Verified by" : "Rejected by"}
                          </p>
                          <p className="font-medium flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {record.verifier.full_name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="flex flex-wrap gap-4 pt-4 border-t text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Submitted: {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}</span>
                    </div>
                    {record.verified_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {record.status === "verified" ? "Verified" : "Rejected"}: {formatDistanceToNow(new Date(record.verified_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
};

export default ManagerVerificationHistory;

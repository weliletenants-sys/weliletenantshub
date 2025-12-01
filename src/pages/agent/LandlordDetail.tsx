import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Phone, User, Building2, DollarSign, Calendar, TrendingUp, Users, Search, MapPin, MessageCircle, ExternalLink, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface LandlordData {
  id: string;
  landlord_name: string;
  landlord_phone: string;
  landlord_id_url: string | null;
  properties: string | null;
  lc1_chairperson_name: string | null;
  lc1_chairperson_phone: string | null;
  village_cell_location: string | null;
  google_maps_link: string | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  registered_by: string;
}

interface TenantData {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  rent_amount: number;
  outstanding_balance: number;
  status: string;
  created_at: string;
}

interface PaymentData {
  id: string;
  amount: number;
  collection_date: string;
  payment_method: string;
  status: string;
  tenant_id: string;
  tenants: {
    id: string;
    tenant_name: string;
  };
}

const AgentLandlordDetail = () => {
  const { landlordId } = useParams();
  const navigate = useNavigate();
  const { agentId } = useAuth();
  const [landlord, setLandlord] = useState<LandlordData | null>(null);
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantSearch, setTenantSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  useEffect(() => {
    fetchLandlordData();
  }, [landlordId, agentId]);

  const fetchLandlordData = async () => {
    if (!landlordId || !agentId) return;

    try {
      // Fetch landlord info
      const { data: landlordData, error: landlordError } = await supabase
        .from("landlords")
        .select("*")
        .eq("id", landlordId)
        .single();

      if (landlordError) throw landlordError;
      setLandlord(landlordData);

      // Fetch tenants under this landlord for current agent
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("*")
        .eq("landlord_id", landlordId)
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Fetch payment history for all tenants under this landlord
      if (tenantsData && tenantsData.length > 0) {
        const tenantIds = tenantsData.map(t => t.id);
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("collections")
          .select(`
            *,
            tenants (id, tenant_name)
          `)
          .in("tenant_id", tenantIds)
          .eq("agent_id", agentId)
          .order("collection_date", { ascending: false })
          .limit(50);

        if (paymentsError) throw paymentsError;
        setPayments(paymentsData || []);
      }
    } catch (error: any) {
      console.error("Error fetching landlord data:", error);
      toast.error("Failed to load landlord details");
      navigate("/agent/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AgentLayout currentPage="/agent/dashboard">
        <div className="text-center py-8">Loading landlord details...</div>
      </AgentLayout>
    );
  }

  if (!landlord) {
    return (
      <AgentLayout currentPage="/agent/dashboard">
        <div className="text-center py-8">Landlord not found</div>
      </AgentLayout>
    );
  }

  const filteredTenants = tenants.filter(tenant =>
    tenant.tenant_name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    tenant.tenant_phone.includes(tenantSearch)
  );

  const filteredPayments = payments.filter(payment =>
    payment.tenants?.tenant_name.toLowerCase().includes(paymentSearch.toLowerCase()) ||
    payment.amount.toString().includes(paymentSearch)
  );

  const totalRent = tenants.reduce((sum, t) => sum + (t.rent_amount || 0), 0);
  const totalOutstanding = tenants.reduce((sum, t) => sum + (t.outstanding_balance || 0), 0);
  const totalCollected = payments
    .filter(p => p.status === "verified")
    .reduce((sum, p) => sum + p.amount, 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      verified: "default",
      paying: "default",
      pending: "secondary",
      late: "destructive",
      defaulted: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <AgentLayout currentPage="/agent/dashboard">
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🏢 {landlord.landlord_name}
            </h1>
            <p className="text-muted-foreground text-sm">Landlord Profile</p>
          </div>
        </div>

        {/* Contact Info & Verification Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
              {landlord.is_verified ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Pending Verification
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="text-lg font-semibold">{landlord.landlord_phone}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.location.href = `tel:${landlord.landlord_phone}`}
                >
                  <Phone className="h-4 w-4" />
                  Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(`https://wa.me/${landlord.landlord_phone.replace(/^0/, '256')}`, '_blank')}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              </div>
            </div>

            {landlord.properties && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Properties</p>
                  <p className="text-lg font-semibold">{landlord.properties}</p>
                </div>
              </div>
            )}

            {landlord.village_cell_location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="text-lg font-semibold">{landlord.village_cell_location}</p>
                </div>
                {landlord.google_maps_link && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.open(landlord.google_maps_link!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Map
                  </Button>
                )}
              </div>
            )}

            {landlord.lc1_chairperson_name && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">LC1 Chairperson</p>
                  <p className="text-lg font-semibold">{landlord.lc1_chairperson_name}</p>
                  {landlord.lc1_chairperson_phone && (
                    <p className="text-sm text-muted-foreground">{landlord.lc1_chairperson_phone}</p>
                  )}
                </div>
                {landlord.lc1_chairperson_phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.location.href = `tel:${landlord.lc1_chairperson_phone}`}
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Registered</p>
                <p className="text-lg font-semibold">
                  {format(new Date(landlord.created_at), "MMM d, yyyy")}
                </p>
              </div>
            </div>

            {landlord.is_verified && landlord.verified_at && (
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Verified On</p>
                  <p className="text-lg font-semibold">
                    {format(new Date(landlord.verified_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{tenants.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Monthly Rent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {totalRent.toLocaleString()}
                <span className="text-base font-normal text-muted-foreground ml-1">UGX</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {totalOutstanding.toLocaleString()}
                <span className="text-base font-normal text-muted-foreground ml-1">UGX</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {totalCollected.toLocaleString()}
                <span className="text-base font-normal text-muted-foreground ml-1">UGX</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <CardTitle>Tenants ({tenants.length})</CardTitle>
            <CardDescription>All tenants under this landlord</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {filteredTenants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {tenantSearch ? "No tenants match your search" : "No tenants found"}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Rent</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow 
                      key={tenant.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/agent/tenant/${tenant.id}`)}
                    >
                      <TableCell className="font-medium text-primary hover:underline">{tenant.tenant_name}</TableCell>
                      <TableCell>{tenant.tenant_phone}</TableCell>
                      <TableCell>UGX {tenant.rent_amount?.toLocaleString()}</TableCell>
                      <TableCell className="font-semibold">
                        UGX {tenant.outstanding_balance?.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/agent/tenant/${tenant.id}`);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Last 50 payments from all tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by tenant name or amount..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {filteredPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {paymentSearch ? "No payments match your search" : "No payments recorded"}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.collection_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell 
                        className="font-medium cursor-pointer text-primary hover:underline"
                        onClick={() => navigate(`/agent/tenant/${payment.tenants?.id}`)}
                      >
                        {payment.tenants?.tenant_name}
                      </TableCell>
                      <TableCell className="font-semibold">
                        UGX {payment.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="capitalize">{payment.payment_method}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            payment.status === "verified"
                              ? "default"
                              : payment.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default AgentLandlordDetail;

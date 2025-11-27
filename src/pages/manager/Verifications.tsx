import { useEffect, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Tenant {
  id: string;
  tenant_name: string;
  landlord_name: string;
  landlord_phone: string;
  lc1_name: string;
  lc1_phone: string;
  rent_amount: number;
  status: string | null;
}

const ManagerVerifications = () => {
  const [pendingVerifications, setPendingVerifications] = useState<Tenant[]>([]);

  useEffect(() => {
    const fetchPendingVerifications = async () => {
      const { data } = await supabase
        .from("tenants")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setPendingVerifications(data || []);
    };

    fetchPendingVerifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('verifications-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants'
        },
        () => {
          fetchPendingVerifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (tenantId: string) => {
    const { error } = await supabase
      .from("tenants")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("id", tenantId);

    if (error) {
      toast.error("Failed to approve verification");
    } else {
      toast.success("Tenant verified successfully");
    }
  };

  const handleReject = async (tenantId: string) => {
    const { error } = await supabase
      .from("tenants")
      .update({ status: "rejected" })
      .eq("id", tenantId);

    if (error) {
      toast.error("Failed to reject verification");
    } else {
      toast.success("Verification rejected");
    }
  };

  return (
    <ManagerLayout currentPage="/manager/verifications">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Landlord Verifications</h1>
          <p className="text-muted-foreground">Review and approve pending verifications</p>
        </div>

        {pendingVerifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">No pending verifications at the moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingVerifications.map((verification) => (
              <Card key={verification.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{verification.tenant_name}</CardTitle>
                      <CardDescription>New tenant registration</CardDescription>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Landlord</p>
                        <p className="font-medium">{verification.landlord_name}</p>
                        <p className="text-sm flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {verification.landlord_phone}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">LC1 Official</p>
                        <p className="font-medium">{verification.lc1_name}</p>
                        <p className="text-sm flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {verification.lc1_phone}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Monthly Rent</p>
                        <p className="font-bold text-lg">
                          UGX {verification.rent_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button 
                      variant="default" 
                      className="flex-1"
                      onClick={() => handleApprove(verification.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve & Verify
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={() => handleReject(verification.id)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`tel:${verification.landlord_phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Call Landlord
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`tel:${verification.lc1_phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Call LC1
                      </a>
                    </Button>
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

export default ManagerVerifications;

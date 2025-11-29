import { useEffect, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { useRealtimeAllTenants, registerSyncCallback } from "@/hooks/useRealtimeSubscription";

interface Tenant {
  id: string;
  tenant_name: string;
  landlord_name: string;
  landlord_phone: string;
  lc1_name: string;
  lc1_phone: string;
  rent_amount: number;
  status: string | null;
  agent_id: string;
  agents?: {
    profiles?: {
      full_name: string;
      phone_number: string;
    };
  };
}

const ManagerVerifications = () => {
  const [pendingVerifications, setPendingVerifications] = useState<Tenant[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Enable real-time updates
  useRealtimeAllTenants();

  const fetchPendingVerifications = async () => {
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
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingVerifications(data || []);
    } catch (error) {
      console.error("Error fetching verifications:", error);
      toast.error("Failed to load verifications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingVerifications();

    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'tenants') {
        console.log(`Real-time update detected on ${table}, refreshing verifications`);
        fetchPendingVerifications();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, []);

  const handleApprove = async (tenantId: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, [tenantId]: true }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { error } = await supabase
        .from("tenants")
        .update({ 
          status: "verified", 
          verified_at: new Date().toISOString()
        })
        .eq("id", tenantId);

      if (error) throw error;

      // Optimistically remove from list
      setPendingVerifications(prev => prev.filter(t => t.id !== tenantId));
      
      toast.success("Tenant verified successfully");
      
      // Refetch to ensure consistency
      await fetchPendingVerifications();
    } catch (error) {
      console.error("Error approving verification:", error);
      toast.error("Failed to approve verification. Please try again.");
    } finally {
      setLoadingStates(prev => ({ ...prev, [tenantId]: false }));
    }
  };

  const handleReject = async (tenantId: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, [tenantId]: true }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { error } = await supabase
        .from("tenants")
        .update({ status: "rejected" })
        .eq("id", tenantId);

      if (error) throw error;

      // Optimistically remove from list
      setPendingVerifications(prev => prev.filter(t => t.id !== tenantId));
      
      toast.success("Verification rejected");
      
      // Refetch to ensure consistency
      await fetchPendingVerifications();
    } catch (error) {
      console.error("Error rejecting verification:", error);
      toast.error("Failed to reject verification. Please try again.");
    } finally {
      setLoadingStates(prev => ({ ...prev, [tenantId]: false }));
    }
  };

  return (
    <ManagerLayout currentPage="/manager/verifications">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Landlord Verifications</h1>
          <p className="text-muted-foreground">Review and approve pending verifications</p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading verifications...</p>
            </CardContent>
          </Card>
        ) : pendingVerifications.length === 0 ? (
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
                      <CardDescription>
                        Submitted by {verification.agents?.profiles?.full_name || 'Unknown Agent'}
                      </CardDescription>
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
                      disabled={loadingStates[verification.id]}
                    >
                      {loadingStates[verification.id] ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve & Verify
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={() => handleReject(verification.id)}
                      disabled={loadingStates[verification.id]}
                    >
                      {loadingStates[verification.id] ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </>
                      )}
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Search, CheckCircle, Clock, Phone, MapPin, Building2, User } from "lucide-react";
import { format } from "date-fns";
import { haptics } from "@/utils/haptics";

interface UnverifiedLandlord {
  id: string;
  landlord_name: string;
  landlord_phone: string;
  properties: string | null;
  village_cell_location: string | null;
  google_maps_link: string | null;
  lc1_chairperson_name: string | null;
  lc1_chairperson_phone: string | null;
  created_at: string;
  registered_by: string;
  agents?: {
    id: string;
    profiles: {
      full_name: string;
      phone_number: string;
    };
  };
}

const UnverifiedLandlords = () => {
  const navigate = useNavigate();
  const [landlords, setLandlords] = useState<UnverifiedLandlord[]>([]);
  const [filteredLandlords, setFilteredLandlords] = useState<UnverifiedLandlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUnverifiedLandlords();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredLandlords(landlords);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = landlords.filter(
        (landlord) =>
          landlord.landlord_name.toLowerCase().includes(query) ||
          landlord.landlord_phone.includes(query) ||
          landlord.agents?.profiles?.full_name.toLowerCase().includes(query)
      );
      setFilteredLandlords(filtered);
    }
  }, [searchQuery, landlords]);

  const fetchUnverifiedLandlords = async () => {
    try {
      const { data, error } = await supabase
        .from("landlords")
        .select(`
          *,
          agents!landlords_registered_by_fkey (
            id,
            profiles!agents_user_id_fkey (
              full_name,
              phone_number
            )
          )
        `)
        .eq("is_verified", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLandlords(data || []);
      setFilteredLandlords(data || []);
    } catch (error) {
      console.error("Error fetching unverified landlords:", error);
      toast.error("Failed to load unverified landlords");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLandlord = async (landlord: UnverifiedLandlord) => {
    if (verifyingIds.has(landlord.id)) return;

    setVerifyingIds((prev) => new Set(prev).add(landlord.id));
    haptics.light();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update landlord verification status
      const { error: verifyError } = await supabase
        .from("landlords")
        .update({
          is_verified: true,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", landlord.id);

      if (verifyError) throw verifyError;

      // Award UGX 500 to the agent who registered this landlord
      if (landlord.agents?.id) {
        const { data: currentAgent, error: fetchError } = await supabase
          .from("agents")
          .select("wallet_balance")
          .eq("id", landlord.agents.id)
          .single();

        if (fetchError) throw fetchError;

        const { error: walletError } = await supabase
          .from("agents")
          .update({
            wallet_balance: (currentAgent.wallet_balance || 0) + 500
          })
          .eq("id", landlord.agents.id);

        if (walletError) throw walletError;
      }

      haptics.success();
      toast.success(`${landlord.landlord_name} verified! UGX 500 awarded to agent`);
      
      // Remove from list
      setLandlords((prev) => prev.filter((l) => l.id !== landlord.id));
    } catch (error) {
      console.error("Error verifying landlord:", error);
      toast.error("Failed to verify landlord");
    } finally {
      setVerifyingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(landlord.id);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <ManagerLayout currentPage="/manager/dashboard">
        <div className="text-center py-8">Loading unverified landlords...</div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/dashboard">
      <div className="space-y-6 pb-20 md:pb-6">
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
              <Clock className="h-6 w-6 text-orange-500" />
              Pending Landlord Verifications
            </h1>
            <p className="text-muted-foreground text-sm">
              Review and verify landlord registrations
            </p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Landlords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by landlord name, phone, or agent name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12"
            />
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">{landlords.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{filteredLandlords.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Potential Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                UGX {(landlords.length * 500).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Landlords List */}
        <Card>
          <CardHeader>
            <CardTitle>Unverified Landlords</CardTitle>
            <CardDescription>
              Click on a landlord to view details or verify their registration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLandlords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No landlords match your search" : "No pending verifications! 🎉"}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLandlords.map((landlord) => (
                  <Card
                    key={landlord.id}
                    className="cursor-pointer hover:shadow-md transition-all"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className="flex-1 space-y-3"
                          onClick={() => navigate(`/manager/landlord/${landlord.id}`)}
                        >
                          <div>
                            <h3 className="text-lg font-semibold">{landlord.landlord_name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Phone className="h-3 w-3" />
                              <span>{landlord.landlord_phone}</span>
                            </div>
                          </div>

                          {landlord.properties && (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Properties:</span>
                              <span className="font-medium">{landlord.properties}</span>
                            </div>
                          )}

                          {landlord.village_cell_location && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{landlord.village_cell_location}</span>
                            </div>
                          )}

                          {landlord.lc1_chairperson_name && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">LC1:</span>
                              <span className="font-medium">{landlord.lc1_chairperson_name}</span>
                              {landlord.lc1_chairperson_phone && (
                                <span className="text-muted-foreground">({landlord.lc1_chairperson_phone})</span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Registered by: <span className="font-medium">{landlord.agents?.profiles?.full_name || "Unknown"}</span></span>
                            <span>•</span>
                            <span>{format(new Date(landlord.created_at), "MMM d, yyyy")}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerifyLandlord(landlord);
                            }}
                            disabled={verifyingIds.has(landlord.id)}
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {verifyingIds.has(landlord.id) ? "Verifying..." : "Verify"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default UnverifiedLandlords;

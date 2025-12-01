import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Search, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

interface LandlordSearchDialogProps {
  userRole: "agent" | "manager";
  agentId?: string;
}

interface LandlordResult {
  id: string;
  landlord_name: string;
  landlord_phone: string;
  created_at: string;
  tenant_count?: number;
}

export const LandlordSearchDialog = ({ userRole, agentId }: LandlordSearchDialogProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LandlordResult[]>([]);

  const handleSearch = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setSearching(true);
    try {
      let query = supabase
        .from("landlords")
        .select(`
          id,
          landlord_name,
          landlord_phone,
          created_at
        `)
        .ilike("landlord_phone", `%${phoneNumber.trim()}%`);

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("No landlords found with that phone number");
        setResults([]);
        return;
      }

      // For agents, filter to only show landlords they've registered tenants for
      if (userRole === "agent" && agentId) {
        const landlordIds = data.map(l => l.id);
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("landlord_id")
          .eq("agent_id", agentId)
          .in("landlord_id", landlordIds);

        const accessibleLandlordIds = new Set(tenantData?.map(t => t.landlord_id) || []);
        const filteredResults = data.filter(l => accessibleLandlordIds.has(l.id));

        if (filteredResults.length === 0) {
          toast.info("No landlords found that you have tenants registered with");
          setResults([]);
          return;
        }

        setResults(filteredResults);
      } else {
        setResults(data);
      }

      toast.success(`Found ${data.length} landlord(s)`);
    } catch (error: any) {
      console.error("Error searching landlords:", error);
      toast.error("Failed to search landlords");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectLandlord = (landlordId: string) => {
    setOpen(false);
    setPhoneNumber("");
    setResults([]);
    if (userRole === "agent") {
      navigate(`/agent/landlord/${landlordId}`);
    } else {
      navigate(`/manager/landlord/${landlordId}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 hover:bg-primary/10 transition-colors"
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline">Search Landlord</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Search Landlord by Phone
          </DialogTitle>
          <DialogDescription>
            Enter the landlord's phone number to view their profile and tenants
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter phone number..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                disabled={searching}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching || !phoneNumber.trim()}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Search Results ({results.length})
              </h3>
              <div className="space-y-2">
                {results.map((landlord) => (
                  <Card
                    key={landlord.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-primary"
                    onClick={() => handleSelectLandlord(landlord.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <p className="font-semibold text-primary hover:underline">
                              {landlord.landlord_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {landlord.landlord_phone}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {results.length === 0 && phoneNumber && !searching && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No landlords found</p>
              <p className="text-sm">Try a different phone number</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

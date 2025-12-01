import { useState, useEffect, useRef } from "react";
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
import { Building2, Search, Phone, User, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

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
  total_outstanding?: number;
}

export const LandlordSearchDialog = ({ userRole, agentId }: LandlordSearchDialogProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LandlordResult[]>([]);
  const [suggestions, setSuggestions] = useState<LandlordResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch autocomplete suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedSearchQuery.trim() || debouncedSearchQuery.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const query = debouncedSearchQuery.trim();
        
        // First, get matching landlords
        let landlordQuery = supabase
          .from("landlords")
          .select("id, landlord_name, landlord_phone, created_at")
          .or(`landlord_name.ilike.%${query}%,landlord_phone.ilike.%${query}%`)
          .limit(5);

        const { data: landlordData, error: landlordError } = await landlordQuery;

        if (landlordError) throw landlordError;
        if (!landlordData || landlordData.length === 0) {
          setSuggestions([]);
          setShowSuggestions(false);
          setLoadingSuggestions(false);
          return;
        }

        // For agents, filter to only show landlords they've registered tenants for
        let filteredLandlords = landlordData;
        if (userRole === "agent" && agentId) {
          const landlordIds = landlordData.map(l => l.id);
          const { data: tenantData } = await supabase
            .from("tenants")
            .select("landlord_id")
            .eq("agent_id", agentId)
            .in("landlord_id", landlordIds);

          const accessibleLandlordIds = new Set(tenantData?.map(t => t.landlord_id) || []);
          filteredLandlords = landlordData.filter(l => accessibleLandlordIds.has(l.id));
        }

        if (filteredLandlords.length === 0) {
          setSuggestions([]);
          setShowSuggestions(false);
          setLoadingSuggestions(false);
          return;
        }

        // Get tenant counts and total outstanding balances for each landlord
        const landlordIds = filteredLandlords.map(l => l.id);
        
        let tenantsQuery = supabase
          .from("tenants")
          .select("landlord_id, outstanding_balance")
          .in("landlord_id", landlordIds);

        // For agents, only count their own tenants
        if (userRole === "agent" && agentId) {
          tenantsQuery = tenantsQuery.eq("agent_id", agentId);
        }

        const { data: tenantsData } = await tenantsQuery;

        // Aggregate tenant data by landlord
        const landlordStats = new Map<string, { count: number; outstanding: number }>();
        tenantsData?.forEach(tenant => {
          const current = landlordStats.get(tenant.landlord_id) || { count: 0, outstanding: 0 };
          landlordStats.set(tenant.landlord_id, {
            count: current.count + 1,
            outstanding: current.outstanding + (tenant.outstanding_balance || 0)
          });
        });

        // Combine landlord data with stats
        const enrichedLandlords: LandlordResult[] = filteredLandlords.map(landlord => ({
          ...landlord,
          tenant_count: landlordStats.get(landlord.id)?.count || 0,
          total_outstanding: landlordStats.get(landlord.id)?.outstanding || 0
        }));

        setSuggestions(enrichedLandlords);
        setShowSuggestions(enrichedLandlords.length > 0);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedSearchQuery, userRole, agentId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a landlord name or phone number");
      return;
    }

    setShowSuggestions(false);
    setSearching(true);
    try {
      const query = searchQuery.trim();
      
      // Search by both name and phone number
      let supabaseQuery = supabase
        .from("landlords")
        .select(`
          id,
          landlord_name,
          landlord_phone,
          created_at
        `)
        .or(`landlord_name.ilike.%${query}%,landlord_phone.ilike.%${query}%`);

      const { data, error } = await supabaseQuery;

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("No landlords found matching your search");
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
    setSearchQuery("");
    setResults([]);
    setSuggestions([]);
    setShowSuggestions(false);
    if (userRole === "agent") {
      navigate(`/agent/landlord/${landlordId}`);
    } else {
      navigate(`/manager/landlord/${landlordId}`);
    }
  };

  const handleSelectSuggestion = (landlord: LandlordResult) => {
    setSearchQuery(landlord.landlord_name);
    setShowSuggestions(false);
    handleSelectLandlord(landlord.id);
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
            Search Landlord
          </DialogTitle>
          <DialogDescription>
            Search by landlord name or phone number to view their profile and tenants
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                ref={inputRef}
                placeholder="Enter landlord name or phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="pl-10"
                disabled={searching}
              />
              
              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {loadingSuggestions ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      Loading suggestions...
                    </div>
                  ) : (
                    <ul className="py-1">
                      {suggestions.map((landlord) => (
                        <li
                          key={landlord.id}
                          onClick={() => handleSelectSuggestion(landlord)}
                          className="px-4 py-3 hover:bg-accent cursor-pointer transition-colors border-b border-border last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <Building2 className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {landlord.landlord_name}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                  {landlord.landlord_phone}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {landlord.tenant_count || 0} {landlord.tenant_count === 1 ? 'tenant' : 'tenants'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    UGX {(landlord.total_outstanding || 0).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
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

          {results.length === 0 && searchQuery && !searching && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No landlords found</p>
              <p className="text-sm">Try a different name or phone number</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

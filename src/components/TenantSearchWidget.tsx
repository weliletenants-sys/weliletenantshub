import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Phone, DollarSign, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { Badge } from "@/components/ui/badge";

interface TenantSearchWidgetProps {
  agentId: string;
}

export const TenantSearchWidget = ({ agentId }: TenantSearchWidgetProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    haptics.light();

    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, tenant_name, tenant_phone, outstanding_balance, status")
        .eq("agent_id", agentId)
        .or(`tenant_name.ilike.%${query}%,tenant_phone.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;

      setSearchResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search tenants");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTenant = (tenantId: string) => {
    haptics.success();
    navigate(`/agent/tenants/${tenantId}`);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <Card className="bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 text-white overflow-hidden relative border-4 border-blue-400/50 shadow-2xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-16 -translate-x-16" />
      
      <CardContent className="p-6 relative z-10">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/25 backdrop-blur-sm rounded-2xl">
              <Search className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Find Your Tenant</h3>
              <p className="text-sm opacity-90">Search by name or phone number</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600" />
            <Input
              placeholder="Enter tenant name or phone..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 h-14 text-lg bg-white text-blue-900 placeholder:text-blue-400 border-0 shadow-lg rounded-2xl font-semibold"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
              {isSearching ? (
                <div className="p-6 text-center text-blue-600">
                  <Search className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="font-semibold">Searching...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-blue-600">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-lg mb-1">No tenants found</p>
                  <p className="text-sm text-muted-foreground">Try a different name or phone number</p>
                </div>
              ) : (
                <div className="divide-y divide-blue-100">
                  {searchResults.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleSelectTenant(tenant.id)}
                      className="w-full p-4 hover:bg-blue-50 transition-all text-left flex items-center gap-3 group"
                    >
                      <div className="p-2 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-blue-900 text-base mb-1 truncate">
                          {tenant.tenant_name}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 text-sm text-blue-600">
                            <Phone className="h-3 w-3" />
                            <span className="font-medium">{tenant.tenant_phone}</span>
                          </div>
                          <Badge 
                            variant={tenant.status === "verified" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {tenant.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-semibold text-blue-700 mt-1">
                          <DollarSign className="h-3 w-3" />
                          <span>UGX {tenant.outstanding_balance?.toLocaleString() || 0}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Action */}
          <Button
            variant="secondary"
            className="w-full h-12 text-base font-bold bg-white text-blue-600 hover:bg-white/90 rounded-xl shadow-lg"
            onClick={() => navigate("/agent/tenants")}
          >
            View All Tenants →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

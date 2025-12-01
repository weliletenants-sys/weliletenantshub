import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { useAuth } from "@/hooks/useAuth";
import { Search, AlertCircle, UserPlus, Wallet, CheckCircle2 } from "lucide-react";
import RegisterLandlord from "./RegisterLandlord";
import { Badge } from "@/components/ui/badge";

type Landlord = {
  id: string;
  landlord_name: string;
  landlord_phone: string;
};

const RegisterTenant = () => {
  const navigate = useNavigate();
  const { agentId } = useAuth();
  const [step, setStep] = useState<"search" | "register_landlord" | "tenant_details">("search");
  const [searchPhone, setSearchPhone] = useState("");
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [selectedLandlord, setSelectedLandlord] = useState<Landlord | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantFormData, setTenantFormData] = useState({
    tenantName: "",
    tenantPhone: "",
    monthlyRent: "",
    unitNumber: "",
  });

  useEffect(() => {
    if (searchPhone.length >= 4) {
      searchLandlords();
    } else {
      setLandlords([]);
    }
  }, [searchPhone]);

  const searchLandlords = async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("landlords")
        .select("*")
        .ilike("landlord_phone", `%${searchPhone}%`)
        .limit(10);

      if (error) throw error;
      setLandlords(data || []);
    } catch (error) {
      console.error("Error searching landlords:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLandlordSelect = (landlord: Landlord) => {
    setSelectedLandlord(landlord);
    setStep("tenant_details");
    haptics.light();
    toast.success(`Landlord selected: ${landlord.landlord_name}`);
  };

  const handleLandlordRegistered = (landlordId: string) => {
    // Fetch the newly registered landlord
    supabase
      .from("landlords")
      .select("*")
      .eq("id", landlordId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSelectedLandlord(data);
          setStep("tenant_details");
        }
      });
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.light(); // Form submission attempt

    if (!agentId || !selectedLandlord) {
      haptics.error(); // Validation error
      toast.error("Missing required information");
      return;
    }

    setIsSubmitting(true);

    try {
      const registrationFee = parseFloat(tenantFormData.monthlyRent) <= 100000 ? 10000 : 20000;

      // Insert tenant
      const { error: tenantError } = await supabase
        .from("tenants")
        .insert({
          agent_id: agentId,
          landlord_id: selectedLandlord.id,
          tenant_name: tenantFormData.tenantName,
          tenant_phone: tenantFormData.tenantPhone,
          rent_amount: parseFloat(tenantFormData.monthlyRent) || 0,
          outstanding_balance: registrationFee,
          registration_fee: registrationFee,
          status: "pending",
        });

      if (tenantError) throw tenantError;

      // Update agent wallet balance (+5000)
      const { data: currentAgent, error: fetchError } = await supabase
        .from("agents")
        .select("wallet_balance")
        .eq("id", agentId)
        .single();

      if (fetchError) throw fetchError;

      const { error: walletError } = await supabase
        .from("agents")
        .update({ 
          wallet_balance: (currentAgent.wallet_balance || 0) + 5000
        })
        .eq("id", agentId);

      if (walletError) throw walletError;

      haptics.success(); // Success feedback
      toast.success("🎉 Tenant registered! UGX 5,000 added to wallet", {
        duration: 5000,
      });

      navigate("/agent/tenants");
    } catch (error) {
      console.error("Error registering tenant:", error);
      haptics.error(); // Error feedback
      toast.error("Failed to register tenant");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTenantFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTenantFormData({ ...tenantFormData, [e.target.name]: e.target.value });
  };

  return (
    <AgentLayout currentPage="/agent/register-tenant">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Register Tenant</h1>
          <p className="text-muted-foreground">
            {step === "search" && "Search for landlord first"}
            {step === "register_landlord" && "Register new landlord"}
            {step === "tenant_details" && "Enter tenant information"}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Badge variant={step === "search" ? "default" : "outline"}>
            1. Find Landlord
          </Badge>
          <div className="h-0.5 w-8 bg-border" />
          <Badge variant={step === "tenant_details" ? "default" : "outline"}>
            2. Tenant Details
          </Badge>
        </div>

        {/* Step 1: Search Landlord */}
        {step === "search" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Landlord by Phone
              </CardTitle>
              <CardDescription>
                Type landlord's phone number to find existing record
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="searchPhone">Landlord Phone Number</Label>
                <Input
                  id="searchPhone"
                  type="tel"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  placeholder="e.g., 0700123456"
                  className="h-14 text-lg"
                  autoFocus
                />
              </div>

              {isSearching && (
                <p className="text-sm text-muted-foreground">Searching...</p>
              )}

              {/* Search Results */}
              {landlords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Found {landlords.length} landlord(s):</p>
                  {landlords.map((landlord) => (
                    <Card
                      key={landlord.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleLandlordSelect(landlord)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">{landlord.landlord_name}</p>
                            <p className="text-sm text-muted-foreground">{landlord.landlord_phone}</p>
                          </div>
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Not Found Message */}
              {searchPhone.length >= 4 && !isSearching && landlords.length === 0 && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-6 w-6 text-destructive mt-1" />
                      <div className="flex-1">
                        <p className="font-semibold text-lg text-destructive mb-2">
                          Landlord not found
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          No landlord with phone number "{searchPhone}" is registered yet.
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      className="w-full h-14 text-lg"
                      onClick={() => setStep("register_landlord")}
                    >
                      <UserPlus className="h-5 w-5 mr-2" />
                      Register New Landlord & Earn UGX 500
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 1b: Register Landlord */}
        {step === "register_landlord" && (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                setStep("search");
                setSearchPhone("");
              }}
              className="mb-4"
            >
              ← Back to Search
            </Button>
            <RegisterLandlord
              prefilledPhone={searchPhone}
              onSuccess={handleLandlordRegistered}
              embedded
            />
          </div>
        )}

        {/* Step 2: Tenant Details */}
        {step === "tenant_details" && selectedLandlord && (
          <div className="space-y-4">
            {/* Selected Landlord Info */}
            <Card className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Selected Landlord</p>
                    <p className="font-semibold text-lg">{selectedLandlord.landlord_name}</p>
                    <p className="text-sm">{selectedLandlord.landlord_phone}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("search");
                      setSelectedLandlord(null);
                    }}
                  >
                    Change
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tenant Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Tenant Details
                </CardTitle>
                <CardDescription>
                  Complete tenant registration and earn UGX 5,000
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTenantSubmit} className="space-y-6">
                  <div className="bg-primary/10 border border-primary rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-semibold text-primary">Instant Reward</p>
                        <p className="text-sm text-muted-foreground">
                          UGX 5,000 added to your wallet immediately
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tenantName">Tenant Name *</Label>
                      <Input
                        id="tenantName"
                        name="tenantName"
                        value={tenantFormData.tenantName}
                        onChange={handleTenantFormChange}
                        placeholder="Enter tenant's full name"
                        required
                        className="h-14 text-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tenantPhone">Tenant Phone *</Label>
                      <Input
                        id="tenantPhone"
                        name="tenantPhone"
                        type="tel"
                        value={tenantFormData.tenantPhone}
                        onChange={handleTenantFormChange}
                        placeholder="e.g., 0700123456"
                        required
                        className="h-14 text-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="monthlyRent">Monthly Rent (UGX) *</Label>
                      <Input
                        id="monthlyRent"
                        name="monthlyRent"
                        type="number"
                        value={tenantFormData.monthlyRent}
                        onChange={handleTenantFormChange}
                        placeholder="Enter monthly rent amount"
                        required
                        min="0"
                        className="h-14 text-lg"
                      />
                      <p className="text-xs text-muted-foreground">
                        Registration fee: {parseFloat(tenantFormData.monthlyRent || "0") <= 100000 ? "UGX 10,000" : "UGX 20,000"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unitNumber">Unit Number (Optional)</Label>
                      <Input
                        id="unitNumber"
                        name="unitNumber"
                        value={tenantFormData.unitNumber}
                        onChange={handleTenantFormChange}
                        placeholder="e.g., A12"
                        className="h-14 text-lg"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-14"
                      onClick={() => {
                        setStep("search");
                        setSelectedLandlord(null);
                      }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 h-14 text-lg" 
                      disabled={isSubmitting || !agentId}
                    >
                      {isSubmitting ? "Registering..." : "Register & Earn UGX 5,000"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AgentLayout>
  );
};

export default RegisterTenant;

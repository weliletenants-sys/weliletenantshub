import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Wallet, Users, TrendingUp, Search, User, Phone, DollarSign, ChevronRight } from "lucide-react";
import { haptics } from "@/utils/haptics";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TenantData {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  outstanding_balance: number;
  status: string;
}

interface AgentPortfolio {
  id: string;
  name: string;
  phone: string;
  tenants: TenantData[];
  totalPortfolioValue: number;
  activeTenants: number;
}

const ManagerPortfolioBreakdown = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agentPortfolios, setAgentPortfolios] = useState<AgentPortfolio[]>([]);
  const [filteredPortfolios, setFilteredPortfolios] = useState<AgentPortfolio[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [totalTenants, setTotalTenants] = useState(0);
  const [openAgents, setOpenAgents] = useState<Set<string>>(new Set());

  const fetchPortfolioBreakdown = async () => {
    try {
      setLoading(true);

      // Fetch all agents with their profiles
      const { data: agents, error: agentsError } = await supabase
        .from("agents")
        .select(`
          id,
          user_id,
          profiles:user_id (
            full_name,
            phone_number
          )
        `);

      if (agentsError) throw agentsError;

      // Fetch all tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select("*")
        .order("tenant_name");

      if (tenantsError) throw tenantsError;

      // Build agent portfolios
      const portfolios: AgentPortfolio[] = agents?.map(agent => {
        const agentTenants = tenants?.filter(t => t.agent_id === agent.id) || [];
        const portfolioValue = agentTenants.reduce(
          (sum, t) => sum + (parseFloat(t.outstanding_balance?.toString() || '0')),
          0
        );

        return {
          id: agent.id,
          name: agent.profiles?.full_name || "Unknown Agent",
          phone: agent.profiles?.phone_number || "",
          tenants: agentTenants,
          totalPortfolioValue: portfolioValue,
          activeTenants: agentTenants.length,
        };
      }) || [];

      // Sort by portfolio value (highest first)
      portfolios.sort((a, b) => b.totalPortfolioValue - a.totalPortfolioValue);

      setAgentPortfolios(portfolios);
      setFilteredPortfolios(portfolios);

      // Calculate totals
      const totalValue = portfolios.reduce((sum, p) => sum + p.totalPortfolioValue, 0);
      const totalTenantsCount = portfolios.reduce((sum, p) => sum + p.activeTenants, 0);

      setTotalPortfolioValue(totalValue);
      setTotalTenants(totalTenantsCount);
    } catch (error: any) {
      console.error("Error fetching portfolio breakdown:", error);
      toast.error("Failed to load portfolio breakdown");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioBreakdown();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = agentPortfolios.filter(
        portfolio =>
          portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          portfolio.phone.includes(searchQuery) ||
          portfolio.tenants.some(
            t =>
              t.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.tenant_phone.includes(searchQuery)
          )
      );
      setFilteredPortfolios(filtered);
    } else {
      setFilteredPortfolios(agentPortfolios);
    }
  }, [searchQuery, agentPortfolios]);

  const toggleAgent = (agentId: string) => {
    haptics.light();
    setOpenAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <ManagerLayout currentPage="/manager/dashboard">
        <div className="space-y-6 pb-20 md:pb-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/dashboard">
      <div className="space-y-6 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/manager/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Portfolio Breakdown</h1>
              <p className="text-muted-foreground">
                Detailed view of agents and tenant portfolios
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Total Portfolio Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                UGX {totalPortfolioValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all agents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agentPortfolios.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Managing tenants
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTenants}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active across platform
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Agents or Tenants
            </CardTitle>
            <CardDescription>
              Filter by agent name, phone, tenant name, or tenant phone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-base"
            />
          </CardContent>
        </Card>

        {/* Agent Portfolios */}
        <div className="space-y-4">
          {filteredPortfolios.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No agents found matching your search</p>
              </CardContent>
            </Card>
          ) : (
            filteredPortfolios.map((portfolio, index) => (
              <Collapsible
                key={portfolio.id}
                open={openAgents.has(portfolio.id)}
                onOpenChange={() => toggleAgent(portfolio.id)}
              >
                <Card className="border-2 hover:border-primary/40 transition-colors">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-left">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg">
                            #{index + 1}
                          </div>
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <User className="h-5 w-5" />
                              {portfolio.name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Phone className="h-4 w-4" />
                              {portfolio.phone}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <p className="text-sm text-muted-foreground">Portfolio Value</p>
                            <p className="text-xl font-bold text-primary">
                              UGX {portfolio.totalPortfolioValue.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Tenants</p>
                            <p className="text-xl font-bold">{portfolio.activeTenants}</p>
                          </div>
                          <Button variant="ghost" size="icon" asChild>
                            <div>
                              <ChevronRight
                                className={`h-5 w-5 transition-transform ${
                                  openAgents.has(portfolio.id) ? "rotate-90" : ""
                                }`}
                              />
                            </div>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 border-t">
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-sm text-muted-foreground">
                            Tenant List ({portfolio.tenants.length})
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/manager/agents/${portfolio.id}`);
                            }}
                          >
                            View Agent Details
                          </Button>
                        </div>

                        {portfolio.tenants.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No tenants assigned to this agent
                          </p>
                        ) : (
                          portfolio.tenants.map((tenant) => (
                            <div
                              key={tenant.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                haptics.light();
                                navigate(`/manager/tenants/${tenant.id}`);
                              }}
                            >
                              <div className="flex-1">
                                <p className="font-medium">{tenant.tenant_name}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {tenant.tenant_phone}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge
                                  variant={
                                    tenant.status === "verified"
                                      ? "default"
                                      : tenant.status === "pending"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="mb-1"
                                >
                                  {tenant.status}
                                </Badge>
                                <p className="text-sm font-semibold flex items-center gap-1 justify-end">
                                  <DollarSign className="h-4 w-4 text-primary" />
                                  UGX {parseFloat(tenant.outstanding_balance?.toString() || "0").toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </div>
      </div>
    </ManagerLayout>
  );
};

export default ManagerPortfolioBreakdown;

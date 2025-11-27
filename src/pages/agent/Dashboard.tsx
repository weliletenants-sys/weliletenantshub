import { useEffect, useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Bike, TrendingUp, Users, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const AgentDashboard = () => {
  const [agentData, setAgentData] = useState<any>(null);
  const [todaysCollections, setTodaysCollections] = useState(0);

  useEffect(() => {
    fetchAgentData();
  }, []);

  const fetchAgentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agent, error } = await supabase
        .from("agents")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching agent data:", error);
        toast.error("Failed to load dashboard data");
        return;
      }

      if (!agent) {
        toast.error("Agent profile not found. Please contact support.");
        return;
      }

      setAgentData(agent);

      // Calculate today's collections
      const { data: collections } = await supabase
        .from("collections")
        .select("amount")
        .eq("agent_id", agent.id)
        .eq("collection_date", new Date().toISOString().split('T')[0]);

      const total = collections?.reduce((sum, col) => sum + parseFloat(col.amount.toString()), 0) || 0;
      setTodaysCollections(total);
    } catch (error: any) {
      toast.error("Failed to load dashboard data");
    }
  };

  const portfolioPercentage = agentData ? (agentData.portfolio_value / agentData.portfolio_limit) * 100 : 0;
  const tenantsToMotorcycle = Math.max(0, 50 - (agentData?.active_tenants || 0));

  return (
    <AgentLayout currentPage="/agent/dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview</p>
        </div>

        {/* Motorcycle Countdown Banner */}
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Bike className="h-12 w-12 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Motorcycle Reward Program</h3>
                <p className="text-lg mb-3">
                  You have <span className="font-bold">{agentData?.active_tenants || 0}</span> active tenants
                </p>
                {tenantsToMotorcycle > 0 ? (
                  <p className="text-xl">
                    Only <span className="font-bold text-3xl">{tenantsToMotorcycle}</span> more tenants to qualify for your FREE motorcycle on pay-as-you-go!
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xl font-bold">🎉 You've qualified for the motorcycle program!</p>
                    <Button variant="secondary" size="lg" className="mt-2">
                      Apply for Motorcycle
                    </Button>
                  </div>
                )}
                <Progress value={(agentData?.active_tenants || 0) * 2} className="mt-4 h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {(agentData?.portfolio_value || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                / {(agentData?.portfolio_limit || 20000000).toLocaleString()} limit
              </p>
              <Progress value={portfolioPercentage} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agentData?.total_tenants || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {agentData?.active_tenants || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Today's Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">UGX {todaysCollections.toLocaleString()}</div>
              <p className="text-xs text-success mt-1">Collections due today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {(agentData?.monthly_earnings || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total earnings</p>
            </CardContent>
          </Card>
        </div>

        {/* Collection Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Collection Performance</CardTitle>
            <CardDescription>
              Maintain 95%+ collection rate to keep your UGX 20M portfolio limit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Collection Rate</span>
                <span className="font-bold">{agentData?.collection_rate || 0}%</span>
              </div>
              <Progress value={agentData?.collection_rate || 0} className="h-3" />
              {(agentData?.collection_rate || 0) < 95 && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg mt-4">
                  <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-warning-foreground">
                    Your collection rate is below 95%. Focus on collecting payments to maintain your portfolio limit.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default AgentDashboard;

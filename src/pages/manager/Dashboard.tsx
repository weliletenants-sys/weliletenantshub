import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, AlertCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const ManagerDashboard = () => {
  // Mock data - would be fetched from database
  const stats = {
    totalAgents: 47,
    activeAgents: 42,
    totalTenants: 523,
    pendingVerifications: 12,
    topAgents: [
      { name: "John Agent", tenants: 28, earnings: 1250000 },
      { name: "Sarah Agent", tenants: 24, earnings: 980000 },
      { name: "Mike Agent", tenants: 22, earnings: 890000 },
    ],
  };

  return (
    <ManagerLayout currentPage="/manager/dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground">Service Centre Overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeAgents} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTenants}</div>
              <p className="text-xs text-success mt-1">Across all agents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pending Verifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {stats.pendingVerifications}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Requires action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">94.2%</div>
              <p className="text-xs text-muted-foreground mt-1">Avg collection rate</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Agents</CardTitle>
            <CardDescription>This week's leaderboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topAgents.map((agent, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent.tenants} tenants
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">UGX {agent.earnings.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="default">
                Pay All Verified Landlords
              </Button>
              <Button className="w-full" variant="outline">
                View Late Tenants
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-warning/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                {stats.pendingVerifications} landlord verifications are pending approval
              </p>
              <Button variant="default">Review Verifications</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ManagerLayout>
  );
};

export default ManagerDashboard;

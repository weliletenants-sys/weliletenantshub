import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Wallet, Target } from "lucide-react";

const AgentEarnings = () => {
  // Mock data - would be fetched from database
  const earnings = {
    thisMonth: 2340000,
    lastMonth: 1890000,
    walletBalance: 487000,
    portfolioValue: 14200000,
    portfolioLimit: 20000000,
    collectionRate: 96,
  };

  const growthRate = ((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth * 100).toFixed(1);

  return (
    <AgentLayout currentPage="/agent/earnings">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Earnings & Portfolio</h1>
          <p className="text-muted-foreground">Track your income and portfolio growth</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Wallet Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {earnings.walletBalance.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Available for withdrawal</p>
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
                UGX {earnings.thisMonth.toLocaleString()}
              </div>
              <p className="text-xs text-success mt-1">
                +{growthRate}% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Last Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {earnings.lastMonth.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Previous earnings</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Health</CardTitle>
            <CardDescription>
              Maintain 95%+ collection rate to keep your UGX 20M limit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Portfolio Usage</span>
                <span className="font-medium">
                  UGX {earnings.portfolioValue.toLocaleString()} / {earnings.portfolioLimit.toLocaleString()}
                </span>
              </div>
              <Progress value={(earnings.portfolioValue / earnings.portfolioLimit) * 100} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Collection Rate</span>
                <span className="font-bold text-success">{earnings.collectionRate}%</span>
              </div>
              <Progress value={earnings.collectionRate} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {earnings.collectionRate >= 95 
                  ? "Excellent! Keep it up to maintain your limit." 
                  : "Warning: Below 95%. Focus on collections to maintain your portfolio limit."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default AgentEarnings;

import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const AgentCollections = () => {
  // Mock data - would be fetched from database
  const dueToday = [
    { id: 1, name: "John Doe", amount: 150000, status: "pending" },
    { id: 2, name: "Jane Smith", amount: 200000, status: "pending" },
    { id: 3, name: "Bob Wilson", amount: 180000, status: "collected" },
  ];

  return (
    <AgentLayout currentPage="/agent/collections">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Today's Collections</h1>
          <p className="text-muted-foreground">Track and manage payments due today</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Collections Due Today</CardTitle>
            <CardDescription>
              {dueToday.filter(t => t.status === "pending").length} payments pending
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dueToday.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    UGX {tenant.amount.toLocaleString()}
                  </p>
                </div>
                {tenant.status === "collected" ? (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Collected</span>
                  </div>
                ) : (
                  <Button size="sm">Mark as Paid</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default AgentCollections;

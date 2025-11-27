import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ManagerAgents = () => {
  // Mock data - would be fetched from database
  const agents = [
    { 
      id: 1, 
      name: "John Agent", 
      phone: "0700123456", 
      tenants: 28, 
      activeTenants: 26,
      collectionRate: 96, 
      earnings: 1250000,
      status: "active" 
    },
    { 
      id: 2, 
      name: "Sarah Agent", 
      phone: "0700234567", 
      tenants: 24, 
      activeTenants: 23,
      collectionRate: 94, 
      earnings: 980000,
      status: "active" 
    },
    { 
      id: 3, 
      name: "Mike Agent", 
      phone: "0700345678", 
      tenants: 22, 
      activeTenants: 20,
      collectionRate: 91, 
      earnings: 890000,
      status: "warning" 
    },
  ];

  return (
    <ManagerLayout currentPage="/manager/agents">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground">Monitor and manage all agents in your area</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Agents</CardTitle>
            <CardDescription>
              Total: {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Collection Rate</TableHead>
                    <TableHead>Monthly Earnings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>{agent.phone}</TableCell>
                      <TableCell>
                        {agent.activeTenants} / {agent.tenants}
                      </TableCell>
                      <TableCell>
                        <span className={agent.collectionRate >= 95 ? "text-success" : "text-warning"}>
                          {agent.collectionRate}%
                        </span>
                      </TableCell>
                      <TableCell>UGX {agent.earnings.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default ManagerAgents;

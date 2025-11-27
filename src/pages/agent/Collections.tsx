import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const AgentCollections = () => {
  const [dueToday, setDueToday] = useState<any[]>([]);
  const [overdueTenants, setOverdueTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCollectionsData();
  }, []);

  const fetchCollectionsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agentData } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agentData) return;

      const today = new Date().toISOString().split('T')[0];

      // Fetch tenants due today
      const { data: todayTenants } = await supabase
        .from('tenants')
        .select('*')
        .eq('agent_id', agentData.id)
        .eq('next_payment_date', today)
        .eq('status', 'active');

      // Fetch overdue tenants
      const { data: overdue } = await supabase
        .from('tenants')
        .select('*')
        .eq('agent_id', agentData.id)
        .eq('status', 'active')
        .lt('next_payment_date', today);

      const overdueWithDays = (overdue || []).map(tenant => {
        const nextDate = new Date(tenant.next_payment_date || '');
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...tenant, daysOverdue };
      });

      setDueToday(todayTenants || []);
      setOverdueTenants(overdueWithDays);

      // Show notification if there are overdue tenants
      if (overdueWithDays.length > 0) {
        const totalOverdue = overdueWithDays.reduce((sum, t) => sum + (t.outstanding_balance || 0), 0);
        const mostOverdue = Math.max(...overdueWithDays.map(t => t.daysOverdue));
        
        toast({
          title: "⚠️ Overdue Payments Alert",
          description: `${overdueWithDays.length} tenant${overdueWithDays.length > 1 ? 's' : ''} overdue • ${mostOverdue} days max • UGX ${totalOverdue.toLocaleString()} owed`,
          variant: "destructive",
          action: (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate('/agent/tenants')}
            >
              View
            </Button>
          ),
        });
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AgentLayout currentPage="/agent/collections">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Today's Collections</h1>
          <p className="text-muted-foreground">Track and manage payments due today</p>
        </div>

        {overdueTenants.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Overdue Payments</CardTitle>
              </div>
              <CardDescription>
                {overdueTenants.length} tenant{overdueTenants.length > 1 ? 's' : ''} with overdue payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overdueTenants.slice(0, 3).map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-3 bg-background rounded-lg cursor-pointer hover:bg-accent"
                  onClick={() => navigate(`/agent/tenants/${tenant.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium">{tenant.tenant_name}</p>
                    <p className="text-sm text-destructive font-semibold">
                      {tenant.daysOverdue} days overdue
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    UGX {(tenant.outstanding_balance || 0).toLocaleString()}
                  </p>
                </div>
              ))}
              {overdueTenants.length > 3 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/agent/tenants')}
                >
                  View All {overdueTenants.length} Overdue Tenants
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Collections Due Today</CardTitle>
            <CardDescription>
              {dueToday.length} payment{dueToday.length !== 1 ? 's' : ''} due today
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : dueToday.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No collections due today</p>
            ) : (
              dueToday.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent"
                  onClick={() => navigate(`/agent/tenants/${tenant.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium">{tenant.tenant_name}</p>
                    <p className="text-sm text-muted-foreground">
                      UGX {(tenant.outstanding_balance || 0).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm">Collect</Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default AgentCollections;

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Activity, UserPlus, DollarSign, Edit, Trash2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { registerSyncCallback } from "@/hooks/useRealtimeSubscription";

interface ActivityItem {
  id: string;
  type: 'tenant_added' | 'tenant_updated' | 'tenant_deleted' | 'payment_recorded' | 'profile_updated';
  agentName: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

interface ActivityFeedProps {
  maxItems?: number;
  className?: string;
}

export const ActivityFeed = ({ maxItems = 15, className }: ActivityFeedProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentActivities = async () => {
    try {
      // Fetch recent audit logs for relevant activities
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .in('table_name', ['tenants', 'collections', 'profiles'])
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (auditError) throw auditError;

      // Fetch recent collections (payments) that might not be in audit logs yet
      const { data: recentCollections, error: collectionsError } = await supabase
        .from('collections')
        .select(`
          id,
          created_at,
          amount,
          agent_id,
          tenant_id,
          tenants (tenant_name),
          agent:agents!inner(
            user_id,
            profiles:profiles!inner(full_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (collectionsError) throw collectionsError;

      // Get unique user IDs from audit logs
      const userIds = [...new Set(auditLogs?.map(log => log.user_id) || [])];
      
      // Fetch profiles for audit log users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Transform audit logs into activities
      const auditActivities: ActivityItem[] = (auditLogs || [])
        .map(log => {
          const agentName = profileMap.get(log.user_id) || 'Unknown Agent';
          const oldData = log.old_data as any;
          const newData = log.new_data as any;

          if (log.table_name === 'tenants') {
            if (log.action === 'INSERT') {
              return {
                id: `audit-${log.id}`,
                type: 'tenant_added' as const,
                agentName,
                description: `added tenant ${newData?.tenant_name || 'Unknown'}`,
                timestamp: log.created_at,
                metadata: { tenantName: newData?.tenant_name }
              } as ActivityItem;
            } else if (log.action === 'UPDATE') {
              return {
                id: `audit-${log.id}`,
                type: 'tenant_updated' as const,
                agentName,
                description: `updated tenant ${newData?.tenant_name || oldData?.tenant_name || 'Unknown'}`,
                timestamp: log.created_at,
                metadata: { tenantName: newData?.tenant_name || oldData?.tenant_name }
              } as ActivityItem;
            } else if (log.action === 'DELETE') {
              return {
                id: `audit-${log.id}`,
                type: 'tenant_deleted' as const,
                agentName,
                description: `deleted tenant ${oldData?.tenant_name || 'Unknown'}`,
                timestamp: log.created_at,
                metadata: { tenantName: oldData?.tenant_name }
              } as ActivityItem;
            }
          } else if (log.table_name === 'profiles' && log.action === 'UPDATE') {
            return {
              id: `audit-${log.id}`,
              type: 'profile_updated' as const,
              agentName,
              description: `updated their profile`,
              timestamp: log.created_at,
            } as ActivityItem;
          }

          return null;
        })
        .filter((activity): activity is ActivityItem => activity !== null);

      // Transform collections into payment activities
      const paymentActivities: ActivityItem[] = (recentCollections || [])
        .map(collection => {
          const agentName = collection.agent?.profiles?.full_name || 'Unknown Agent';
          const tenantName = collection.tenants?.tenant_name || 'Unknown';

          return {
            id: `payment-${collection.id}`,
            type: 'payment_recorded' as const,
            agentName,
            description: `recorded payment of UGX ${Number(collection.amount).toLocaleString()} from ${tenantName}`,
            timestamp: collection.created_at,
            metadata: { amount: collection.amount, tenantName }
          };
        });

      // Merge and sort all activities by timestamp
      const allActivities = [...auditActivities, ...paymentActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, maxItems);

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivities();

    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'tenants' || table === 'collections' || table === 'profiles') {
        console.log(`Real-time update detected on ${table}, refreshing activity feed`);
        fetchRecentActivities();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, []);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'tenant_added':
        return <UserPlus className="h-4 w-4 text-green-600" />;
      case 'tenant_updated':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'tenant_deleted':
        return <Trash2 className="h-4 w-4 text-destructive" />;
      case 'payment_recorded':
        return <DollarSign className="h-4 w-4 text-primary" />;
      case 'profile_updated':
        return <Edit className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityBadgeVariant = (type: ActivityItem['type']) => {
    switch (type) {
      case 'tenant_added':
        return 'default';
      case 'tenant_updated':
        return 'secondary';
      case 'tenant_deleted':
        return 'destructive';
      case 'payment_recorded':
        return 'default';
      case 'profile_updated':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Live Activity Feed</CardTitle>
          </div>
          <CardDescription>Loading recent agent activities...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Live Activity Feed</CardTitle>
          </div>
          <Badge variant="outline" className="animate-pulse">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
            Live
          </Badge>
        </div>
        <CardDescription>Real-time stream of agent activities</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground">No recent activities</p>
              <p className="text-sm text-muted-foreground mt-1">
                Agent actions will appear here in real-time
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors duration-200"
                >
                  <div className="mt-0.5 p-2 rounded-full bg-background border">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">
                          {activity.agentName}
                        </span>{' '}
                        <span className="text-muted-foreground">
                          {activity.description}
                        </span>
                      </p>
                      <Badge
                        variant={getActivityBadgeVariant(activity.type)}
                        className="text-xs shrink-0"
                      >
                        {activity.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

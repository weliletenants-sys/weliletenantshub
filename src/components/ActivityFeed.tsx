import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Activity, UserPlus, DollarSign, Edit, Trash2, Clock, Filter, X, CalendarIcon, ChevronDown, Search } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { registerSyncCallback } from "@/hooks/useRealtimeSubscription";
import { useNavigate } from "react-router-dom";
import { ClickableAgentName } from "./ClickableAgentName";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ActivityItem {
  id: string;
  type: 'tenant_added' | 'tenant_updated' | 'tenant_deleted' | 'payment_recorded' | 'profile_updated';
  agentName: string;
  agentId?: string;
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
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string }>>([]);

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
            profiles!agents_user_id_fkey(full_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (collectionsError) throw collectionsError;

      // Get unique user IDs from audit logs
      const userIds = [...new Set(auditLogs?.map(log => log.user_id) || [])];
      
      // Fetch profiles and agent IDs for audit log users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch agents to map user_id to agent_id
      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('id, user_id')
        .in('user_id', userIds);

      if (agentsError) throw agentsError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      const userToAgentMap = new Map(agents?.map(a => [a.user_id, a.id]) || []);

      // Transform audit logs into activities
      const auditActivities: ActivityItem[] = (auditLogs || [])
        .map(log => {
          const agentName = profileMap.get(log.user_id) || 'Unknown Agent';
          const agentId = userToAgentMap.get(log.user_id);
          const oldData = log.old_data as any;
          const newData = log.new_data as any;

          if (log.table_name === 'tenants') {
            if (log.action === 'INSERT') {
              return {
                id: `audit-${log.id}`,
                type: 'tenant_added' as const,
                agentName,
                agentId,
                description: `added tenant ${newData?.tenant_name || 'Unknown'}`,
                timestamp: log.created_at,
                metadata: { tenantName: newData?.tenant_name }
              } as ActivityItem;
            } else if (log.action === 'UPDATE') {
              return {
                id: `audit-${log.id}`,
                type: 'tenant_updated' as const,
                agentName,
                agentId,
                description: `updated tenant ${newData?.tenant_name || oldData?.tenant_name || 'Unknown'}`,
                timestamp: log.created_at,
                metadata: { tenantName: newData?.tenant_name || oldData?.tenant_name }
              } as ActivityItem;
            } else if (log.action === 'DELETE') {
              return {
                id: `audit-${log.id}`,
                type: 'tenant_deleted' as const,
                agentName,
                agentId,
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
              agentId,
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
            agentId: collection.agent_id,
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
      
      // Extract unique agents for filter dropdown
      const uniqueAgents = Array.from(
        new Map(
          allActivities.map(activity => [activity.agentName, activity.agentName])
        ).entries()
      ).map(([name]) => ({ id: name, name }));
      
      setAvailableAgents(uniqueAgents);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters whenever activities or filter criteria change
  useEffect(() => {
    let filtered = [...activities];

    // Filter by text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(activity => {
        // Search in agent name
        if (activity.agentName.toLowerCase().includes(query)) return true;
        
        // Search in description
        if (activity.description.toLowerCase().includes(query)) return true;
        
        // Search in tenant name if available
        if (activity.metadata?.tenantName?.toLowerCase().includes(query)) return true;
        
        // Search in payment amount if available
        if (activity.metadata?.amount && activity.metadata.amount.toString().includes(query)) return true;
        
        return false;
      });
    }

    // Filter by activity type
    if (activityTypeFilter !== "all") {
      filtered = filtered.filter(activity => activity.type === activityTypeFilter);
    }

    // Filter by agent
    if (agentFilter !== "all") {
      filtered = filtered.filter(activity => activity.agentName === agentFilter);
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter(activity => 
        new Date(activity.timestamp) >= startDate
      );
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(activity => 
        new Date(activity.timestamp) <= endOfDay
      );
    }

    setFilteredActivities(filtered);
  }, [activities, activityTypeFilter, agentFilter, startDate, endDate, searchQuery]);

  const clearFilters = () => {
    setActivityTypeFilter("all");
    setAgentFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchQuery("");
  };

  const hasActiveFilters = 
    activityTypeFilter !== "all" || 
    agentFilter !== "all" || 
    startDate !== undefined || 
    endDate !== undefined ||
    searchQuery.trim() !== "";

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
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                {filteredActivities.length} filtered
              </Badge>
            )}
            <Badge variant="outline" className="animate-pulse">
              <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
              Live
            </Badge>
          </div>
        </div>
        <CardDescription>Real-time stream of agent activities</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search activities (tenant name, amount, description...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filter Controls */}
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="h-5 text-xs">
                      {[
                        searchQuery.trim() && "Search",
                        activityTypeFilter !== "all" && "Type",
                        agentFilter !== "all" && "Agent",
                        startDate && "Start",
                        endDate && "End"
                      ].filter(Boolean).length}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  showFilters && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="pt-4">
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Activity Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Activity Type</label>
                  <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="tenant_added">Tenant Added</SelectItem>
                      <SelectItem value="tenant_updated">Tenant Updated</SelectItem>
                      <SelectItem value="tenant_deleted">Tenant Deleted</SelectItem>
                      <SelectItem value="payment_recorded">Payment Recorded</SelectItem>
                      <SelectItem value="profile_updated">Profile Updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Agent Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent</label>
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {availableAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.name}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <ScrollArea className="h-[400px] pr-4">
          {filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground">
                {hasActiveFilters ? "No activities match your filters" : "No recent activities"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasActiveFilters 
                  ? "Try adjusting your filter criteria" 
                  : "Agent actions will appear here in real-time"}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity) => (
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
                          {activity.agentId ? (
                            <ClickableAgentName
                              agentId={activity.agentId}
                              agentName={activity.agentName}
                              className="font-semibold"
                            />
                          ) : (
                            <span className="font-semibold text-foreground">
                              {activity.agentName}
                            </span>
                          )}{' '}
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

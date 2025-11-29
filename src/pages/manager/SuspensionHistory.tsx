import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Shield, ShieldOff, Clock, User, FileText, Search, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface SuspensionEvent {
  id: string;
  action: 'suspend' | 'reactivate';
  timestamp: string;
  agent_id: string;
  agent_name: string;
  manager_id: string;
  manager_name: string;
  reason: string;
  old_data: any;
  new_data: any;
}

const ManagerSuspensionHistory = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<SuspensionEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<SuspensionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<'all' | 'suspend' | 'reactivate'>('all');

  const fetchSuspensionHistory = async () => {
    try {
      setLoading(true);

      // Fetch audit logs for agent suspensions
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'agents')
        .eq('action', 'UPDATE')
        .order('created_at', { ascending: false });

      if (auditError) throw auditError;

      // Filter for suspension-related changes
      const suspensionLogs = auditLogs?.filter(log => {
        const changedFields = log.changed_fields || [];
        return changedFields.includes('is_suspended') || 
               changedFields.includes('suspended_at') ||
               changedFields.includes('suspension_reason');
      }) || [];

      // Get unique user IDs (managers who performed the actions)
      const managerIds = [...new Set(suspensionLogs.map(log => log.user_id))];
      
      // Fetch manager profiles
      const { data: managerProfiles, error: managerError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', managerIds);

      if (managerError) throw managerError;

      const managerMap = new Map(managerProfiles?.map(p => [p.id, p.full_name]) || []);

      // Get unique agent IDs from old_data and new_data
      const agentUserIds = new Set<string>();
      suspensionLogs.forEach(log => {
        const oldData = log.old_data as any;
        const newData = log.new_data as any;
        if (oldData?.user_id) agentUserIds.add(oldData.user_id);
        if (newData?.user_id) agentUserIds.add(newData.user_id);
      });

      // Fetch agent profiles
      const { data: agentProfiles, error: agentError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(agentUserIds));

      if (agentError) throw agentError;

      const agentMap = new Map(agentProfiles?.map(p => [p.id, p.full_name]) || []);

      // Transform logs into suspension events
      const suspensionEvents: SuspensionEvent[] = suspensionLogs.map(log => {
        const oldData = log.old_data as any;
        const newData = log.new_data as any;
        
        // Determine if this was a suspension or reactivation
        const isSuspension = newData?.is_suspended === true && oldData?.is_suspended !== true;
        const action = isSuspension ? 'suspend' : 'reactivate';
        
        // Get agent user_id from either old or new data
        const agentUserId = newData?.user_id || oldData?.user_id;
        const agentName = agentUserId ? (agentMap.get(agentUserId) || 'Unknown Agent') : 'Unknown Agent';
        
        return {
          id: log.id,
          action,
          timestamp: log.created_at,
          agent_id: log.record_id,
          agent_name: agentName,
          manager_id: log.user_id,
          manager_name: managerMap.get(log.user_id) || 'Unknown Manager',
          reason: newData?.suspension_reason || oldData?.suspension_reason || 'No reason provided',
          old_data: oldData,
          new_data: newData,
        };
      });

      setEvents(suspensionEvents);
      setFilteredEvents(suspensionEvents);
    } catch (error: any) {
      console.error("Error fetching suspension history:", error);
      toast.error("Failed to load suspension history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuspensionHistory();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...events];

    // Filter by action type
    if (actionFilter !== 'all') {
      filtered = filtered.filter(e => e.action === actionFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.agent_name.toLowerCase().includes(query) ||
        e.manager_name.toLowerCase().includes(query) ||
        e.reason.toLowerCase().includes(query)
      );
    }

    setFilteredEvents(filtered);
  }, [events, actionFilter, searchQuery]);

  const clearFilters = () => {
    setActionFilter('all');
    setSearchQuery("");
    toast.success("Filters cleared");
  };

  const hasActiveFilters = actionFilter !== 'all' || searchQuery.trim() !== "";

  if (loading) {
    return (
      <ManagerLayout currentPage="/manager/agents">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/agents">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/manager/agents")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Suspension History</h1>
            <p className="text-muted-foreground">
              Complete audit trail of all agent suspensions and reactivations
            </p>
          </div>
          <Badge variant="outline" className="text-base px-4 py-2">
            {filteredEvents.length} events
          </Badge>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{events.length}</div>
              <p className="text-xs text-muted-foreground">
                All suspension actions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspensions</CardTitle>
              <ShieldOff className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {events.filter(e => e.action === 'suspend').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Agents suspended
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reactivations</CardTitle>
              <Shield className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {events.filter(e => e.action === 'reactivate').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Agents reactivated
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
                <CardDescription>Search and filter suspension events</CardDescription>
              </div>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by agent, manager, or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Action Filter */}
              <Select value={actionFilter} onValueChange={(value: any) => setActionFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="suspend">Suspensions Only</SelectItem>
                  <SelectItem value="reactivate">Reactivations Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Suspension Events Table */}
        <Card>
          <CardHeader>
            <CardTitle>Suspension Events</CardTitle>
            <CardDescription>
              {filteredEvents.length === 0 && hasActiveFilters
                ? "No events match your filters"
                : `Showing ${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <ShieldOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {hasActiveFilters ? "No events match your filters" : "No suspension events found"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge
                            variant={event.action === 'suspend' ? 'destructive' : 'default'}
                            className="flex items-center gap-2 w-fit"
                          >
                            {event.action === 'suspend' ? (
                              <ShieldOff className="h-3 w-3" />
                            ) : (
                              <Shield className="h-3 w-3" />
                            )}
                            {event.action === 'suspend' ? 'Suspended' : 'Reactivated'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{event.agent_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{event.manager_name}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2 max-w-md">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-sm">{event.reason}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <div>
                              <div>{format(new Date(event.timestamp), 'MMM d, yyyy')}</div>
                              <div className="text-xs">{format(new Date(event.timestamp), 'h:mm a')}</div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default ManagerSuspensionHistory;

import { useState, useEffect } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { FileText, User, Calendar, Edit, Trash2, Search, Filter, ChevronDown, ChevronUp, RefreshCw, Database, Plus } from "lucide-react";
import { format } from "date-fns";
import PullToRefresh from "react-simple-pull-to-refresh";
import { haptics } from "@/utils/haptics";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: any;
  new_data: any;
  changed_fields: string[];
  created_at: string;
  manager_name?: string;
  tenant_name?: string;
}

const ManagerAuditLog = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Filters
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [auditLogs, tableFilter, actionFilter, searchQuery, startDate, endDate]);

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);
      
      // Fetch ALL audit logs from all tables
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsError) throw logsError;

      // Get unique user IDs
      const userIds = [...new Set(logs?.map(log => log.user_id) || [])];
      
      // Fetch manager names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user IDs to profiles
      const userMap = new Map(profiles?.map(p => [p.id, { full_name: p.full_name, phone_number: p.phone_number }]) || []);

      // Enrich logs with manager names and record names
      const enrichedLogs = (logs || []).map(log => {
        const oldData = log.old_data as any;
        const newData = log.new_data as any;
        const userProfile = userMap.get(log.user_id);
        
        return {
          ...log,
          manager_name: userProfile?.full_name || 'Unknown Manager',
          tenant_name: oldData?.tenant_name || newData?.tenant_name || null,
        };
      });

      setAuditLogs(enrichedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...auditLogs];

    // Table filter
    if (tableFilter !== "all") {
      filtered = filtered.filter(log => log.table_name === tableFilter);
    }

    // Action filter
    if (actionFilter !== "all") {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => {
        const managerName = log.manager_name?.toLowerCase() || "";
        const tableName = log.table_name.toLowerCase();
        const tenantName = log.tenant_name?.toLowerCase() || "";
        return managerName.includes(query) || tableName.includes(query) || tenantName.includes(query);
      });
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(log => new Date(log.created_at) >= startDate);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.created_at) <= endOfDay);
    }

    setFilteredLogs(filtered);
  };

  const handleRefresh = async () => {
    haptics.refresh();
    await fetchAuditLogs();
    toast.success("Audit logs refreshed");
  };

  const clearFilters = () => {
    setTableFilter("all");
    setActionFilter("all");
    setSearchQuery("");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const getActionBadge = (action: string) => {
    if (action === 'INSERT') {
      return (
        <Badge className="bg-success/10 text-success border-success/20 gap-1">
          <Plus className="h-3 w-3" />
          Created
        </Badge>
      );
    }
    if (action === 'UPDATE') {
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1">
          <Edit className="h-3 w-3" />
          Updated
        </Badge>
      );
    }
    if (action === 'DELETE') {
      return (
        <Badge variant="destructive" className="gap-1">
          <Trash2 className="h-3 w-3" />
          Deleted
        </Badge>
      );
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case "tenants":
        return "👤";
      case "agents":
        return "👥";
      case "collections":
        return "💰";
      case "profiles":
        return "📋";
      default:
        return "📄";
    }
  };

  const formatFieldName = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getFieldValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'string' && value.includes('T')) {
      // Likely a date
      try {
        return format(new Date(value), 'MMM d, yyyy');
      } catch {
        return value;
      }
    }
    return value.toString();
  };

  const uniqueTables = [...new Set(auditLogs.map(log => log.table_name))];

  if (isLoading) {
    return (
      <ManagerLayout currentPage="/manager/audit-log">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/audit-log">
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileText className="h-8 w-8 text-primary" />
                Audit Log
              </h1>
              <p className="text-muted-foreground">Complete history of system changes across all tables</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button onClick={handleRefresh} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{auditLogs.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Filtered</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{filteredLogs.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Tables</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{uniqueTables.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Managers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{[...new Set(auditLogs.map(l => l.user_id))].length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          {showFilters && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filter Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search manager, table..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Table</label>
                    <Select value={tableFilter} onValueChange={setTableFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All tables" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tables</SelectItem>
                        {uniqueTables.map(table => (
                          <SelectItem key={table} value={table}>
                            {getTableIcon(table)} {table}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Action</label>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="INSERT">INSERT</SelectItem>
                        <SelectItem value="UPDATE">UPDATE</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <Calendar className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "MMM dd, yyyy") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <Calendar className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM dd, yyyy") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit Logs List */}
          {filteredLogs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No audit logs found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {auditLogs.length === 0 
                    ? "No activity has been logged yet" 
                    : "Try adjusting your filters"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[700px]">
              <div className="space-y-3 pr-4">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <Card key={log.id} className="overflow-hidden">
                      <Collapsible open={isExpanded} onOpenChange={() => setExpandedLogId(isExpanded ? null : log.id)}>
                        <CollapsibleTrigger className="w-full">
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 text-left space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getActionBadge(log.action)}
                                  <Badge variant="outline" className="gap-1">
                                    <Database className="h-3 w-3" />
                                    {getTableIcon(log.table_name)} {log.table_name}
                                  </Badge>
                                  {log.changed_fields && log.changed_fields.length > 0 && (
                                    <Badge variant="secondary">
                                      {log.changed_fields.length} field{log.changed_fields.length !== 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {log.manager_name}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(log.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                                  </span>
                                  {log.tenant_name && (
                                    <span className="font-medium">
                                      Tenant: {log.tenant_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <CardContent className="pt-0 space-y-4">
                            {log.action === 'UPDATE' && log.changed_fields && log.changed_fields.length > 0 && (
                              <div className="border-t pt-4">
                                <h4 className="font-semibold mb-3">Changed Fields</h4>
                                <div className="space-y-3">
                                  {log.changed_fields.map((field) => {
                                    const oldData = log.old_data as any;
                                    const newData = log.new_data as any;
                                    const oldValue = oldData?.[field];
                                    const newValue = newData?.[field];
                                    
                                    return (
                                      <div key={field} className="bg-muted/30 p-3 rounded-lg border border-border">
                                        <p className="text-sm font-semibold mb-2">{formatFieldName(field)}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                          <div>
                                            <p className="text-xs text-muted-foreground mb-1">Old:</p>
                                            <p className="text-sm text-destructive font-mono break-all">
                                              {getFieldValue(oldValue)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground mb-1">New:</p>
                                            <p className="text-sm text-success font-mono break-all">
                                              {getFieldValue(newValue)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </PullToRefresh>
    </ManagerLayout>
  );
};

export default ManagerAuditLog;

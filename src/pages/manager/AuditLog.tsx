import { useState, useEffect } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, User, Calendar, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      // Fetch audit logs
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'tenants')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Get unique user IDs
      const userIds = [...new Set(logs?.map(log => log.user_id) || [])];
      
      // Fetch manager names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user IDs to names
      const userMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Enrich logs with manager names and tenant names
      const enrichedLogs = (logs || []).map(log => {
        const oldData = log.old_data as any;
        const newData = log.new_data as any;
        return {
          ...log,
          manager_name: userMap.get(log.user_id) || 'Unknown',
          tenant_name: oldData?.tenant_name || newData?.tenant_name || 'Unknown',
        };
      });

      setAuditLogs(enrichedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    if (action === 'UPDATE') {
      return (
        <Badge variant="secondary" className="gap-1">
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
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Audit Log</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Manager actions on tenant records
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Recent Activity</CardTitle>
            <CardDescription className="text-base">
              Showing last 100 manager actions on tenant records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No audit logs found</p>
                <p className="text-sm mt-2">Manager actions will appear here</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Changes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {format(new Date(log.created_at), 'MMM d, yyyy')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(log.created_at), 'h:mm a')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{log.manager_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <span className="font-medium">{log.tenant_name}</span>
                        </TableCell>
                        <TableCell>
                          {log.action === 'DELETE' ? (
                            <Badge variant="destructive" className="text-xs">
                              Record Deleted
                            </Badge>
                          ) : log.changed_fields && log.changed_fields.length > 0 ? (
                            <div className="space-y-2">
                              {log.changed_fields.map((field) => {
                                const oldData = log.old_data as any;
                                const newData = log.new_data as any;
                                const oldValue = oldData?.[field];
                                const newValue = newData?.[field];
                                return (
                                  <div key={field} className="text-sm">
                                    <p className="font-medium text-muted-foreground">
                                      {formatFieldName(field)}:
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {getFieldValue(oldValue)}
                                      </Badge>
                                      <span className="text-muted-foreground">→</span>
                                      <Badge variant="default" className="text-xs">
                                        {getFieldValue(newValue)}
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No changes</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default ManagerAuditLog;

import { useEffect, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Smartphone, Tablet, Monitor, AlertCircle, TrendingUp, Clock, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PerformanceMetric {
  id: string;
  user_id: string;
  device_type: string;
  browser: string;
  os: string;
  page_route: string;
  load_time_ms: number;
  error_type: string;
  error_message: string;
  network_latency_ms: number;
  memory_usage_mb: number;
  created_at: string;
}

const PerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const timeRanges = {
        '1h': new Date(Date.now() - 60 * 60 * 1000),
        '24h': new Date(Date.now() - 24 * 60 * 60 * 1000),
        '7d': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      };

      const { data, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .gte('created_at', timeRanges[timeRange].toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate statistics
  const deviceBreakdown = metrics.reduce((acc, metric) => {
    acc[metric.device_type] = (acc[metric.device_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deviceData = Object.entries(deviceBreakdown).map(([device, count]) => ({
    name: device,
    value: count,
  }));

  const avgLoadTime = metrics.length > 0
    ? Math.round(metrics.filter(m => m.load_time_ms).reduce((sum, m) => sum + m.load_time_ms, 0) / metrics.filter(m => m.load_time_ms).length)
    : 0;

  const avgLatency = metrics.length > 0
    ? Math.round(metrics.filter(m => m.network_latency_ms).reduce((sum, m) => sum + m.network_latency_ms, 0) / metrics.filter(m => m.network_latency_ms).length)
    : 0;

  const avgMemory = metrics.length > 0
    ? Math.round(metrics.filter(m => m.memory_usage_mb).reduce((sum, m) => sum + m.memory_usage_mb, 0) / metrics.filter(m => m.memory_usage_mb).length)
    : 0;

  const errorCount = metrics.filter(m => m.error_type).length;
  const errorRate = metrics.length > 0 ? ((errorCount / metrics.length) * 100).toFixed(1) : '0.0';

  // Load time by device
  const loadTimeByDevice = Object.entries(
    metrics
      .filter(m => m.load_time_ms)
      .reduce((acc, m) => {
        if (!acc[m.device_type]) acc[m.device_type] = [];
        acc[m.device_type].push(m.load_time_ms);
        return acc;
      }, {} as Record<string, number[]>)
  ).map(([device, times]) => ({
    device,
    avgLoadTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
  }));

  // Recent errors
  const recentErrors = metrics
    .filter(m => m.error_type)
    .slice(0, 10);

  return (
    <ManagerLayout currentPage="/manager/performance-monitor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance Monitor</h1>
            <p className="text-muted-foreground mt-1">
              Track app stability and performance across all devices
            </p>
          </div>
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Load Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{avgLoadTime}ms</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average page load time
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network Latency</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{avgLatency}ms</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average network response
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{avgMemory}MB</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average memory footprint
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{errorRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {errorCount} errors detected
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Device Distribution</CardTitle>
              <CardDescription>App usage by device type</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Load Time by Device</CardTitle>
              <CardDescription>Average page load performance</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={loadTimeByDevice}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="device" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgLoadTime" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Errors */}
        {recentErrors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Latest detected issues across devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentErrors.map((error) => (
                  <div
                    key={error.id}
                    className="flex items-start gap-4 p-4 border border-border rounded-lg"
                  >
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="destructive">{error.error_type}</Badge>
                        <Badge variant="outline">{error.device_type}</Badge>
                        <Badge variant="outline">{error.os}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(error.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{error.page_route}</p>
                      <p className="text-sm">{error.error_message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && metrics.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Performance Data</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Performance metrics will appear here once agents and managers start using the app.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ManagerLayout>
  );
};

export default PerformanceMonitor;

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { performanceMonitor, PerformanceMetric } from '@/lib/performanceMonitor';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Visual indicator showing performance metrics and slow operations
 * Displays in corner for debugging and monitoring
 */
export const PerformanceIndicator = () => {
  const [slowOpsCount, setSlowOpsCount] = useState(0);
  const [recentMetrics, setRecentMetrics] = useState<PerformanceMetric[]>([]);
  const [summary, setSummary] = useState(performanceMonitor.getSummary());

  useEffect(() => {
    // Subscribe to new metrics
    const unsubscribe = performanceMonitor.subscribe((metric) => {
      if (metric.duration > 1000) {
        setSlowOpsCount(prev => prev + 1);
      }
      setRecentMetrics(performanceMonitor.getMetrics().slice(-10).reverse());
      setSummary(performanceMonitor.getSummary());
    });

    // Initial load
    setRecentMetrics(performanceMonitor.getMetrics().slice(-10).reverse());
    setSummary(performanceMonitor.getSummary());

    return unsubscribe;
  }, []);

  const handleClear = () => {
    performanceMonitor.clear();
    setSlowOpsCount(0);
    setRecentMetrics([]);
    setSummary(performanceMonitor.getSummary());
  };

  const handleExport = () => {
    const data = performanceMonitor.export();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (process.env.NODE_ENV === 'production') {
    return null; // Hide in production
  }

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 shadow-lg"
          >
            <Activity className="h-4 w-4" />
            {slowOpsCount > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center">
                {slowOpsCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Performance Monitor
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  className="h-7 text-xs"
                >
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Summary */}
            <Card className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">API Calls:</span>
                  <span className="ml-2 font-medium">{summary.apiCalls}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg API:</span>
                  <span className="ml-2 font-medium">{summary.avgApiDuration}ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Renders:</span>
                  <span className="ml-2 font-medium">{summary.renders}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Render:</span>
                  <span className="ml-2 font-medium">{summary.avgRenderDuration}ms</span>
                </div>
              </div>
              
              {summary.slowOperations > 0 && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{summary.slowOperations} slow operations detected</span>
                </div>
              )}
            </Card>

            {/* Recent Metrics */}
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                Recent Operations
              </h4>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {recentMetrics.map((metric, index) => (
                    <Card
                      key={`${metric.name}-${index}`}
                      className={`p-2 ${
                        metric.duration > 1000
                          ? 'border-destructive bg-destructive/5'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {metric.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {metric.type} • {new Date(metric.timestamp).toLocaleTimeString()}
                          </div>
                          {metric.metadata && Object.keys(metric.metadata).length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {JSON.stringify(metric.metadata)}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant={metric.duration > 1000 ? 'destructive' : 'secondary'}
                          className="ml-2 shrink-0"
                        >
                          {Math.round(metric.duration)}ms
                        </Badge>
                      </div>
                    </Card>
                  ))}
                  {recentMetrics.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No metrics recorded yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

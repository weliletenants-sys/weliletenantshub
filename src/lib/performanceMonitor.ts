/**
 * Performance monitoring utilities
 * Tracks slow operations, API response times, and render metrics
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: 'api' | 'render' | 'operation';
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 100; // Keep last 100 metrics
  private readonly slowThreshold = 1000; // 1 second
  private observers: Set<(metric: PerformanceMetric) => void> = new Set();

  /**
   * Track an operation's performance
   */
  track(
    name: string,
    type: 'api' | 'render' | 'operation',
    duration: number,
    metadata?: Record<string, any>
  ) {
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      type,
      metadata,
    };

    // Add to metrics array
    this.metrics.push(metric);

    // Keep array size manageable
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    if (duration > this.slowThreshold) {
      console.warn(
        `⚠️ Slow ${type}: ${name} took ${duration}ms`,
        metadata
      );
    } else {
      console.log(
        `✓ ${type}: ${name} completed in ${duration}ms`,
        metadata
      );
    }

    // Notify observers
    this.observers.forEach(observer => observer(metric));

    return metric;
  }

  /**
   * Start timing an operation
   */
  start(name: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      return duration;
    };
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    name: string,
    type: 'api' | 'operation',
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.track(name, type, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.track(name, type, duration, { 
        ...metadata, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics by type
   */
  getMetricsByType(type: 'api' | 'render' | 'operation'): PerformanceMetric[] {
    return this.metrics.filter(m => m.type === type);
  }

  /**
   * Get slow operations
   */
  getSlowOperations(): PerformanceMetric[] {
    return this.metrics.filter(m => m.duration > this.slowThreshold);
  }

  /**
   * Get average duration for a specific operation
   */
  getAverageDuration(name: string): number {
    const operationMetrics = this.metrics.filter(m => m.name === name);
    if (operationMetrics.length === 0) return 0;
    
    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const apiMetrics = this.getMetricsByType('api');
    const renderMetrics = this.getMetricsByType('render');
    const operationMetrics = this.getMetricsByType('operation');
    const slowOps = this.getSlowOperations();

    return {
      totalMetrics: this.metrics.length,
      apiCalls: apiMetrics.length,
      renders: renderMetrics.length,
      operations: operationMetrics.length,
      slowOperations: slowOps.length,
      avgApiDuration: this.calculateAverage(apiMetrics),
      avgRenderDuration: this.calculateAverage(renderMetrics),
      avgOperationDuration: this.calculateAverage(operationMetrics),
      slowestOperation: this.getSlowestOperation(),
    };
  }

  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return Math.round(total / metrics.length);
  }

  private getSlowestOperation(): PerformanceMetric | null {
    if (this.metrics.length === 0) return null;
    return this.metrics.reduce((slowest, current) =>
      current.duration > slowest.duration ? current : slowest
    );
  }

  /**
   * Subscribe to new metrics
   */
  subscribe(callback: (metric: PerformanceMetric) => void): () => void {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
    console.log('Performance metrics cleared');
  }

  /**
   * Export metrics for analysis
   */
  export(): string {
    return JSON.stringify({
      metrics: this.metrics,
      summary: this.getSummary(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const trackApi = (name: string, duration: number, metadata?: Record<string, any>) =>
  performanceMonitor.track(name, 'api', duration, metadata);

export const trackRender = (name: string, duration: number, metadata?: Record<string, any>) =>
  performanceMonitor.track(name, 'render', duration, metadata);

export const trackOperation = (name: string, duration: number, metadata?: Record<string, any>) =>
  performanceMonitor.track(name, 'operation', duration, metadata);

export const measureAsync = <T>(
  name: string,
  type: 'api' | 'operation',
  fn: () => Promise<T>,
  metadata?: Record<string, any>
) => performanceMonitor.measure(name, type, fn, metadata);

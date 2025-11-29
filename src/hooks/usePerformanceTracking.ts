import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PerformanceMetric {
  device_type: 'mobile' | 'tablet' | 'desktop';
  browser?: string;
  os?: string;
  screen_resolution: string;
  page_route: string;
  load_time_ms?: number;
  error_type?: string;
  error_message?: string;
  network_latency_ms?: number;
  memory_usage_mb?: number;
}

const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  return browser;
};

const getOSInfo = () => {
  const ua = navigator.userAgent;
  let os = 'Unknown';
  
  if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  
  return os;
};

const getMemoryUsage = (): number | undefined => {
  // @ts-ignore - memory is a non-standard property
  if (performance.memory) {
    // @ts-ignore
    return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024); // Convert to MB
  }
  return undefined;
};

/**
 * Hook to track and send performance metrics to the database
 */
export const usePerformanceTracking = (pageRoute: string) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const trackMetric = async () => {
      const metric: PerformanceMetric = {
        device_type: getDeviceType(),
        browser: getBrowserInfo(),
        os: getOSInfo(),
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        page_route: pageRoute,
        load_time_ms: Math.round(performance.now()),
        memory_usage_mb: getMemoryUsage(),
      };

      try {
        await supabase.from('performance_metrics').insert({
          user_id: user.id,
          ...metric,
        });
      } catch (error) {
        console.error('Error tracking performance metric:', error);
      }
    };

    // Track page load
    trackMetric();

    // Track errors
    const handleError = (event: ErrorEvent) => {
      const errorMetric: PerformanceMetric = {
        device_type: getDeviceType(),
        browser: getBrowserInfo(),
        os: getOSInfo(),
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        page_route: pageRoute,
        error_type: 'JavaScript Error',
        error_message: event.message,
        memory_usage_mb: getMemoryUsage(),
      };

      supabase.from('performance_metrics').insert({
        user_id: user.id,
        ...errorMetric,
      }).then(({ error }) => {
        if (error) console.error('Error tracking error metric:', error);
      });
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [user, pageRoute]);
};

/**
 * Function to track network latency
 */
export const trackNetworkLatency = async (userId: string, pageRoute: string) => {
  const startTime = performance.now();
  
  try {
    await supabase.from('profiles').select('id').limit(1).single();
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);

    await supabase.from('performance_metrics').insert({
      user_id: userId,
      device_type: getDeviceType(),
      browser: getBrowserInfo(),
      os: getOSInfo(),
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      page_route: pageRoute,
      network_latency_ms: latency,
      memory_usage_mb: getMemoryUsage(),
    });
  } catch (error) {
    console.error('Error tracking network latency:', error);
  }
};

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Visual indicator showing when app is checking for updates
 * Displayed in the corner to give feedback on automatic update checks
 */
export const UpdateIndicator = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    // Listen for custom update check events
    const handleUpdateCheck = () => {
      setIsChecking(true);
      setLastChecked(new Date());
      
      // Hide after 2 seconds
      setTimeout(() => {
        setIsChecking(false);
      }, 2000);
    };

    window.addEventListener('version-check-start', handleUpdateCheck);
    
    return () => {
      window.removeEventListener('version-check-start', handleUpdateCheck);
    };
  }, []);

  if (!isChecking && !lastChecked) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-fade-in">
      <Badge
        variant="secondary"
        className={`flex items-center gap-2 text-xs shadow-lg transition-opacity ${
          isChecking ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
        {isChecking ? 'Checking for updates...' : 'Up to date'}
      </Badge>
    </div>
  );
};

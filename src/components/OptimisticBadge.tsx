import { Zap } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface OptimisticBadgeProps {
  show: boolean;
  className?: string;
}

/**
 * Subtle badge indicating an optimistic update is in progress
 * Shows briefly while server confirms the change
 */
export const OptimisticBadge = ({ show, className }: OptimisticBadgeProps) => {
  if (!show) return null;

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "gap-1.5 animate-in fade-in duration-200",
        className
      )}
    >
      <Zap className="h-3 w-3 animate-pulse text-primary" />
      <span className="text-xs">Updating...</span>
    </Badge>
  );
};

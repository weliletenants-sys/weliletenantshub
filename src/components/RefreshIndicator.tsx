import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RefreshIndicatorProps {
  isRefreshing: boolean;
  className?: string;
}

export const RefreshIndicator = ({ isRefreshing, className }: RefreshIndicatorProps) => {
  if (!isRefreshing) return null;

  return (
    <div
      className={cn(
        "fixed top-16 right-4 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm font-medium">Updating...</span>
    </div>
  );
};

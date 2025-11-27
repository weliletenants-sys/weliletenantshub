import { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useRipple } from "@/hooks/useRipple";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

interface BottomNavigationProps {
  items: NavItem[];
  currentPage?: string;
}

/**
 * Android-style bottom navigation bar for mobile devices
 * Fixed at bottom with large touch targets
 */
const BottomNavigation = ({ items, currentPage }: BottomNavigationProps) => {
  const navigate = useNavigate();
  const createRipple = useRipple();

  // Show max 5 items in bottom nav (typical Android pattern)
  const displayItems = items.slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 md:hidden safe-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {displayItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.path;
          
          return (
            <button
              key={item.path}
              onClick={(e) => {
                createRipple(e);
                navigate(item.path);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px] min-h-[48px]",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className={cn("h-6 w-6", isActive && "scale-110")} />
              <span className={cn("text-xs font-medium", isActive && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Safe area spacer for devices with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)] bg-card" />
    </nav>
  );
};

export default BottomNavigation;

import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import WelileLogo from "./WelileLogo";
import OfflineSyncIndicator from "./OfflineSyncIndicator";
import { CacheIndicator } from "./CacheIndicator";
import Breadcrumbs from "./Breadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { Home, Users, Plus, DollarSign, TrendingUp, LogOut, MessageSquare, BarChart3, Settings, Receipt, FileText, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useRipple } from "@/hooks/useRipple";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import SwipeBackIndicator from "./SwipeBackIndicator";
import BottomNavigation from "./BottomNavigation";
import { NotificationsPanel } from "./NotificationsPanel";

interface AgentLayoutProps {
  children: ReactNode;
  currentPage?: string;
}

const AgentLayout = ({ children, currentPage }: AgentLayoutProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const createRipple = useRipple();
  const { swipeProgress } = useSwipeBack();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login?role=agent");
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/agent/dashboard" },
    { icon: Users, label: "Tenants", path: "/agent/tenants" },
    { icon: Plus, label: "New Tenant", path: "/agent/new-tenant" },
    { icon: DollarSign, label: "Collections", path: "/agent/collections" },
    { icon: TrendingUp, label: "Earnings", path: "/agent/earnings" },
  ];

  const moreNavItems = [
    { icon: BarChart3, label: "Weekly Report", path: "/agent/weekly-summary" },
    { icon: MessageSquare, label: "AI Assistant", path: "/agent/ai-assistant" },
    { icon: Receipt, label: "Receipt History", path: "/agent/receipt-history" },
    { icon: FileText, label: "Printable Rates", path: "/agent/printable-rates" },
    { icon: BookOpen, label: "Training", path: "/agent/training" },
    { icon: Settings, label: "Settings", path: "/agent/settings" },
  ];

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SwipeBackIndicator progress={swipeProgress} />
      
      <header className="bg-card border-b border-border p-6 flex justify-between items-center">
        <WelileLogo />
        <div className="flex items-center gap-4">
          <OfflineSyncIndicator />
          <CacheIndicator />
          <NotificationsPanel />
          <Button variant="ghost" size="default" onClick={handleLogout}>
            <LogOut className="h-5 w-5 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar - Desktop only */}
        <nav className="hidden md:block bg-card border-r border-border p-6 md:w-72">
          <div className="space-y-3">
            {[...navItems, ...moreNavItems].map((item) => (
              <Button
                key={item.path}
                variant={currentPage === item.path ? "default" : "ghost"}
                className="w-full justify-start h-14 text-base"
                size="lg"
                onClick={(e) => {
                  createRipple(e);
                  navigate(item.path);
                }}
              >
                <item.icon className="h-6 w-6 mr-3" />
                {item.label}
              </Button>
            ))}
            
            <div className="pt-6 mt-6 border-t border-border">
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-base"
                size="lg"
                onClick={() => navigate("/")}
              >
                <Home className="h-6 w-6 mr-3" />
                Back to Home
              </Button>
            </div>
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto pb-20 md:pb-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation items={navItems} currentPage={currentPage} />
    </div>
  );
};

export default AgentLayout;

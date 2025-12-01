import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import WelileLogo from "./WelileLogo";
import OfflineSyncIndicator from "./OfflineSyncIndicator";
import { CacheIndicator } from "./CacheIndicator";
import Breadcrumbs from "./Breadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { Home, Users, Plus, DollarSign, TrendingUp, LogOut, MessageSquare, BarChart3, Settings, Receipt, FileText, BookOpen, Calculator, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRipple } from "@/hooks/useRipple";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import SwipeBackIndicator from "./SwipeBackIndicator";
import BottomNavigation from "./BottomNavigation";
import { NotificationsPanel } from "./NotificationsPanel";
import { LandlordSearchDialog } from "./LandlordSearchDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

interface AgentLayoutProps {
  children: ReactNode;
  currentPage?: string;
}

const AgentLayout = ({ children, currentPage }: AgentLayoutProps) => {
  const navigate = useNavigate();
  const createRipple = useRipple();
  const { swipeProgress } = useSwipeBack();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { agentId } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/agent/dashboard" },
    { icon: Users, label: "Tenants", path: "/agent/tenants" },
    { icon: UserPlus, label: "+ Register Landlord", path: "/agent/register-landlord" },
    { icon: Plus, label: "+ Register Tenant", path: "/agent/register-tenant" },
    { icon: DollarSign, label: "Collections", path: "/agent/collections" },
  ];

  const moreNavItems = [
    { icon: TrendingUp, label: "Earnings", path: "/agent/earnings" },
    { icon: Calculator, label: "Daily Calculator", path: "/agent/calculator" },
    { icon: BarChart3, label: "Weekly Report", path: "/agent/weekly-summary" },
    { icon: MessageSquare, label: "AI Assistant", path: "/agent/ai-assistant" },
    { icon: Receipt, label: "Receipt History", path: "/agent/receipt-history" },
    { icon: FileText, label: "Printable Rates", path: "/agent/printable-rates" },
    { icon: BookOpen, label: "Training", path: "/agent/training" },
    { icon: Settings, label: "Settings", path: "/agent/settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SwipeBackIndicator progress={swipeProgress} />
      
      <header className="bg-card border-b border-border p-6 flex justify-between items-center">
        <WelileLogo />
        <div className="flex items-center gap-2 md:gap-4">
          <LandlordSearchDialog userRole="agent" agentId={agentId} />
          <OfflineSyncIndicator />
          <CacheIndicator />
          <NotificationsPanel />
          <Button variant="ghost" size="default" onClick={() => setShowLogoutDialog(true)}>
            <LogOut className="h-5 w-5 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out? You'll need to log in again to access your agent dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

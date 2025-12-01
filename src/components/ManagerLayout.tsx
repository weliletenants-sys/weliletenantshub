import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import WelileLogo from "./WelileLogo";
import Breadcrumbs from "./Breadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, CheckSquare, LogOut, Settings, Home, TrendingUp, FileText, DollarSign, History, MailCheck, Printer, Calculator, Activity, ArrowDownToLine, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { useRipple } from "@/hooks/useRipple";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useRealtimeLandlordNotifications } from "@/hooks/useRealtimeLandlordNotifications";
import SwipeBackIndicator from "./SwipeBackIndicator";
import BottomNavigation from "./BottomNavigation";
import { LandlordSearchDialog } from "./LandlordSearchDialog";
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

interface ManagerLayoutProps {
  children: ReactNode;
  currentPage?: string;
}

const ManagerLayout = ({ children, currentPage }: ManagerLayoutProps) => {
  const navigate = useNavigate();
  const createRipple = useRipple();
  const { swipeProgress } = useSwipeBack();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Enable realtime notifications for landlord registrations
  useRealtimeLandlordNotifications(true);

  const handleLogout = async () => {
    haptics.success();
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/manager/dashboard" },
    { icon: Users, label: "Agents", path: "/manager/agents" },
    { icon: DollarSign, label: "Payment Verifications", path: "/manager/payment-verifications" },
    { icon: ArrowDownToLine, label: "Withdrawal Approvals", path: "/manager/withdrawal-approvals" },
    { icon: ArrowRightLeft, label: "Transfer History", path: "/manager/transfer-history" },
    { icon: History, label: "Verification History", path: "/manager/verification-history" },
    { icon: MailCheck, label: "Delivery Reports", path: "/manager/delivery-reports" },
    { icon: TrendingUp, label: "Weekly Report", path: "/manager/weekly-report" },
    { icon: Activity, label: "Performance Monitor", path: "/manager/performance-monitor" },
    { icon: Calculator, label: "Daily Calculator", path: "/manager/calculator" },
    { icon: FileText, label: "Audit Log", path: "/manager/audit-log" },
    { icon: CheckSquare, label: "Tenant Verifications", path: "/manager/verifications" },
    { icon: Printer, label: "Printable Rates", path: "/manager/printable-rates" },
    { icon: Settings, label: "Settings", path: "/manager/settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SwipeBackIndicator progress={swipeProgress} />
      
      <header className="bg-card border-b border-border p-6 flex justify-between items-center">
        <WelileLogo />
        <div className="flex items-center gap-2 md:gap-4">
          <LandlordSearchDialog userRole="manager" />
          <Button 
            variant="ghost" 
            size="default" 
            onClick={() => {
              haptics.light();
              setShowLogoutDialog(true);
            }}
          >
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
              Are you sure you want to log out? You'll need to log in again to access your manager dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => haptics.light()}>Cancel</AlertDialogCancel>
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
            {navItems.map((item) => (
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
                onClick={(e) => {
                  createRipple(e);
                  haptics.light();
                  navigate("/");
                }}
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

export default ManagerLayout;

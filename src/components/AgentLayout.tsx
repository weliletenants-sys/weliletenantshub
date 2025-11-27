import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import WelileLogo from "./WelileLogo";
import OfflineSyncIndicator from "./OfflineSyncIndicator";
import { supabase } from "@/integrations/supabase/client";
import { Home, Users, Plus, DollarSign, TrendingUp, LogOut, MessageSquare, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface AgentLayoutProps {
  children: ReactNode;
  currentPage?: string;
}

const AgentLayout = ({ children, currentPage }: AgentLayoutProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

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
    { icon: BarChart3, label: "Weekly Report", path: "/agent/weekly-summary" },
    { icon: MessageSquare, label: "AI Assistant", path: "/agent/ai-assistant" },
  ];

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border p-4 flex justify-between items-center">
        <WelileLogo />
        <div className="flex items-center gap-3">
          <OfflineSyncIndicator />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        <nav className="bg-card border-b md:border-b-0 md:border-r border-border p-4 md:w-64">
          <div className="space-y-2">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={currentPage === item.path ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </Button>
            ))}
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AgentLayout;

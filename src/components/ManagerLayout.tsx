import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import WelileLogo from "./WelileLogo";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, CheckSquare, LogOut, Settings, Home } from "lucide-react";
import { toast } from "sonner";

interface ManagerLayoutProps {
  children: ReactNode;
  currentPage?: string;
}

const ManagerLayout = ({ children, currentPage }: ManagerLayoutProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login?role=manager");
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/manager/dashboard" },
    { icon: Users, label: "Agents", path: "/manager/agents" },
    { icon: CheckSquare, label: "Verifications", path: "/manager/verifications" },
    { icon: Settings, label: "Settings", path: "/manager/settings" },
  ];

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border p-4 flex justify-between items-center">
        <WelileLogo />
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
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
            
            <div className="pt-4 mt-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate("/")}
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ManagerLayout;

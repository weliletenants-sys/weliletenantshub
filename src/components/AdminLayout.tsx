import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, Wrench, UserCog, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import WelileLogo from "@/components/WelileLogo";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
}

const adminRoutes = [
  {
    path: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview and statistics"
  },
  {
    path: "/admin/roles",
    label: "Role Management",
    icon: UserCog,
    description: "Manage user roles and permissions"
  },
  {
    path: "/admin/profile-repair",
    label: "Profile Repair",
    icon: Wrench,
    description: "Fix profile data issues"
  },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">System Administration</p>
            </div>
          </div>
          <WelileLogo />
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid md:grid-cols-[250px_1fr] gap-6">
          {/* Sidebar Navigation */}
          <aside className="space-y-2">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Admin Tools
              </h2>
            </div>
            
            {adminRoutes.map((route) => {
              const Icon = route.icon;
              const isActive = location.pathname === route.path;
              
              return (
                <Button
                  key={route.path}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => navigate(route.path)}
                >
                  <Icon className="h-4 w-4" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{route.label}</span>
                    {!isActive && (
                      <span className="text-xs text-muted-foreground">
                        {route.description}
                      </span>
                    )}
                  </div>
                </Button>
              );
            })}

            <div className="pt-4 border-t mt-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => navigate("/")}
              >
                <Home className="h-4 w-4" />
                <span>Back to Home</span>
              </Button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-h-[calc(100vh-200px)]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;

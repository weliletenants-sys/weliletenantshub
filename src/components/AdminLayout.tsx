import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, Wrench, UserCog, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import WelileLogo from "@/components/WelileLogo";
import Breadcrumbs from "@/components/Breadcrumbs";
import { cn } from "@/lib/utils";
import { useRipple } from "@/hooks/useRipple";

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
  const createRipple = useRipple();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">System Administration</p>
            </div>
          </div>
          <WelileLogo />
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid md:grid-cols-[250px_1fr] gap-6">
          {/* Sidebar Navigation */}
          <aside className="space-y-3">
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
                    "w-full justify-start gap-4 h-14 text-base",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  size="lg"
                  onClick={(e) => {
                    createRipple(e);
                    navigate(route.path);
                  }}
                >
                  <Icon className="h-6 w-6" />
                  <div className="flex flex-col items-start">
                    <span className="text-base font-medium">{route.label}</span>
                    {!isActive && (
                      <span className="text-xs text-muted-foreground">
                        {route.description}
                      </span>
                    )}
                  </div>
                </Button>
              );
            })}

            <div className="pt-6 border-t mt-6">
              <Button
                variant="outline"
                className="w-full justify-start gap-4 h-14 text-base"
                size="lg"
                onClick={() => navigate("/")}
              >
                <Home className="h-6 w-6" />
                <span>Back to Home</span>
              </Button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-h-[calc(100vh-200px)]">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;

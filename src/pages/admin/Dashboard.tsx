import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserCog, Wrench, AlertCircle, TrendingUp, Building2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { hasRole } from "@/lib/userRoles";

interface DashboardStats {
  totalUsers: number;
  totalAgents: number;
  totalManagers: number;
  totalAdmins: number;
  totalTenants: number;
  totalCollections: number;
  recentUsers: Array<{
    id: string;
    full_name: string | null;
    phone_number: string;
    created_at: string;
    role: string;
  }>;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAgents: 0,
    totalManagers: 0,
    totalAdmins: 0,
    totalTenants: 0,
    totalCollections: 0,
    recentUsers: [],
  });

  useEffect(() => {
    checkAccessAndLoadStats();
  }, []);

  const checkAccessAndLoadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in first");
        navigate("/login");
        return;
      }

      const isAdmin = await hasRole(user.id, 'admin');
      const isManager = await hasRole(user.id, 'manager');

      if (!isAdmin && !isManager) {
        toast.error("Admin or Manager access required");
        navigate("/");
        return;
      }

      await loadDashboardStats();
    } catch (error) {
      console.error('Error checking access:', error);
      toast.error("Failed to verify access");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      // Get total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get role counts
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role');

      const agentCount = roleData?.filter(r => r.role === 'agent').length || 0;
      const managerCount = roleData?.filter(r => r.role === 'manager').length || 0;
      const adminCount = roleData?.filter(r => r.role === 'admin').length || 0;

      // Get total tenants
      const { count: tenantsCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      // Get total collections
      const { count: collectionsCount } = await supabase
        .from('collections')
        .select('*', { count: 'exact', head: true });

      // Get recent users (last 5)
      const { data: recentProfiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalUsers: usersCount || 0,
        totalAgents: agentCount,
        totalManagers: managerCount,
        totalAdmins: adminCount,
        totalTenants: tenantsCount || 0,
        totalCollections: collectionsCount || 0,
        recentUsers: recentProfiles || [],
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      toast.error("Failed to load dashboard statistics");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Admin Dashboard</h2>
          <p className="text-muted-foreground">System overview and quick access to admin tools</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">All registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
              <p className="text-xs text-muted-foreground">Active field agents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Managers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalManagers}</div>
              <p className="text-xs text-muted-foreground">Service centre managers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <UserCog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAdmins}</div>
              <p className="text-xs text-muted-foreground">System administrators</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTenants}</div>
              <p className="text-xs text-muted-foreground">Registered tenants</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collections</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCollections}</div>
              <p className="text-xs text-muted-foreground">Payment records</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Tools</CardTitle>
            <CardDescription>Quick access to system administration tools</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4 space-y-2"
              onClick={() => navigate('/admin/roles')}
            >
              <div className="flex items-center gap-2 w-full">
                <UserCog className="h-5 w-5" />
                <span className="font-semibold">Role Management</span>
              </div>
              <p className="text-xs text-muted-foreground text-left">
                Assign and manage user roles and permissions
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4 space-y-2"
              onClick={() => navigate('/admin/profile-repair')}
            >
              <div className="flex items-center gap-2 w-full">
                <Wrench className="h-5 w-5" />
                <span className="font-semibold">Profile Repair</span>
              </div>
              <p className="text-xs text-muted-foreground text-left">
                Detect and fix profile data inconsistencies
              </p>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Newly registered users in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No recent users found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{user.full_name || 'Unnamed User'}</p>
                      <p className="text-xs text-muted-foreground">{user.phone_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;

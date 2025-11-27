import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import WelileLogo from "@/components/WelileLogo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasRole, addUserRole, removeUserRole, AppRole } from "@/lib/userRoles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserWithRoles {
  id: string;
  phone_number: string;
  full_name: string | null;
  roles: AppRole[];
}

const RoleManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [processingUser, setProcessingUser] = useState<string | null>(null);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in first");
        navigate("/login");
        return false;
      }

      const isUserAdmin = await hasRole(user.id, 'admin');
      if (!isUserAdmin) {
        toast.error("Admin access required");
        setIsAdmin(false);
        return false;
      }

      setIsAdmin(true);
      return true;
    } catch (error) {
      console.error('Error checking admin access:', error);
      toast.error("Failed to verify admin access");
      return false;
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!profiles) {
        setUsers([]);
        return;
      }

      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          return {
            id: profile.id,
            phone_number: profile.phone_number,
            full_name: profile.full_name,
            roles: (roleData || []).map(r => r.role as AppRole),
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminAccess().then(hasAccess => {
      if (hasAccess) {
        loadUsers();
      }
    });
  }, []);

  const handleAddRole = async (userId: string, role: AppRole) => {
    setProcessingUser(userId);
    try {
      const { error } = await addUserRole(userId, role);
      if (error) throw error;

      toast.success(`Added ${role} role successfully`);
      await loadUsers();
    } catch (error) {
      console.error('Error adding role:', error);
      toast.error("Failed to add role");
    } finally {
      setProcessingUser(null);
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    setProcessingUser(userId);
    try {
      // Prevent removing last role
      const user = users.find(u => u.id === userId);
      if (user && user.roles.length === 1) {
        toast.error("Cannot remove the last role from a user");
        setProcessingUser(null);
        return;
      }

      const { error } = await removeUserRole(userId, role);
      if (error) throw error;

      toast.success(`Removed ${role} role successfully`);
      await loadUsers();
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error("Failed to remove role");
    } finally {
      setProcessingUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <WelileLogo />
        <Alert variant="destructive" className="max-w-md mt-6">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need administrator privileges to access this tool.
          </AlertDescription>
        </Alert>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <UserCog className="h-8 w-8" />
              Role Management
            </h1>
            <p className="text-muted-foreground">Manage user roles and permissions</p>
          </div>
          <WelileLogo />
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Admin Tool</AlertTitle>
          <AlertDescription>
            Promote or demote users between admin, manager, and agent roles. Users can have multiple roles.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>All Users ({users.length})</CardTitle>
            <CardDescription>
              Manage role assignments for all users in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Current Roles</TableHead>
                    <TableHead>Add Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Unnamed User'}</p>
                          <p className="text-xs text-muted-foreground">{user.phone_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {user.roles.length === 0 ? (
                            <Badge variant="outline">No roles</Badge>
                          ) : (
                            user.roles.map(role => (
                              <Badge 
                                key={role}
                                variant={role === 'admin' ? 'destructive' : role === 'manager' ? 'default' : 'secondary'}
                                className="gap-2"
                              >
                                {role}
                                <button
                                  onClick={() => handleRemoveRole(user.id, role)}
                                  disabled={processingUser === user.id}
                                  className="hover:text-destructive-foreground"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select 
                          onValueChange={(value) => handleAddRole(user.id, value as AppRole)}
                          disabled={processingUser === user.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Add role" />
                          </SelectTrigger>
                          <SelectContent>
                            {!user.roles.includes('admin') && (
                              <SelectItem value="admin">Admin</SelectItem>
                            )}
                            {!user.roles.includes('manager') && (
                              <SelectItem value="manager">Manager</SelectItem>
                            )}
                            {!user.roles.includes('agent') && (
                              <SelectItem value="agent">Agent</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button onClick={loadUsers} variant="outline">
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;

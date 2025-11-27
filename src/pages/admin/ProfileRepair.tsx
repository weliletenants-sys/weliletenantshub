import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AdminLayout from "@/components/AdminLayout";

interface UserIssue {
  userId: string;
  email: string;
  metadata: any;
  missingProfile: boolean;
  missingRoleRecord: boolean;
  role?: string;
}

const ProfileRepair = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [issues, setIssues] = useState<UserIssue[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const checkAdminAccess = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in first");
        navigate("/login");
        return false;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role !== 'admin') {
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
    } finally {
      setLoading(false);
    }
  };

  const scanForIssues = async () => {
    const hasAccess = await checkAdminAccess();
    if (!hasAccess) return;

    setScanning(true);
    const foundIssues: UserIssue[] = [];

    try {
      // Get all auth users (admin query via service role would be needed for production)
      // For now we'll check profiles table and cross-reference
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id');

      const profileIds = new Set(profiles?.map(p => p.id) || []);

      // Check each user we can access
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Since we can't directly query auth.users from client, 
      // we'll check for orphaned agent/manager records
      const { data: agents } = await supabase
        .from('agents')
        .select('user_id');

      const { data: managers } = await supabase
        .from('service_centre_managers')
        .select('user_id');

      const agentUserIds = new Set(agents?.map(a => a.user_id) || []);
      const managerUserIds = new Set(managers?.map(m => m.user_id) || []);

      // Check profiles without agent/manager records
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*');

      for (const profile of allProfiles || []) {
        let hasIssue = false;
        let missingRoleRecord = false;

        if (profile.role === 'agent' && !agentUserIds.has(profile.id)) {
          hasIssue = true;
          missingRoleRecord = true;
        } else if (profile.role === 'manager' && !managerUserIds.has(profile.id)) {
          hasIssue = true;
          missingRoleRecord = true;
        }

        if (hasIssue) {
          foundIssues.push({
            userId: profile.id,
            email: profile.phone_number + '@welile.local',
            metadata: profile,
            missingProfile: false,
            missingRoleRecord: missingRoleRecord,
            role: profile.role,
          });
        }
      }

      setIssues(foundIssues);
      
      if (foundIssues.length === 0) {
        toast.success("No issues found! All profiles are healthy.");
      } else {
        toast.warning(`Found ${foundIssues.length} profile issue(s)`);
      }
    } catch (error) {
      console.error('Error scanning for issues:', error);
      toast.error("Failed to scan for issues");
    } finally {
      setScanning(false);
    }
  };

  const fixAllIssues = async () => {
    setFixing(true);
    let fixed = 0;
    let failed = 0;

    try {
      for (const issue of issues) {
        try {
          // Fix missing role records
          if (issue.missingRoleRecord && issue.role) {
            if (issue.role === 'agent') {
              const { error } = await supabase
                .from('agents')
                .insert({ user_id: issue.userId });
              
              if (error) throw error;
            } else if (issue.role === 'manager') {
              const { error } = await supabase
                .from('service_centre_managers')
                .insert({ user_id: issue.userId });
              
              if (error) throw error;
            }
          }

          fixed++;
        } catch (err) {
          console.error(`Failed to fix user ${issue.userId}:`, err);
          failed++;
        }
      }

      if (fixed > 0) {
        toast.success(`Fixed ${fixed} profile issue(s)`);
      }
      if (failed > 0) {
        toast.error(`Failed to fix ${failed} issue(s)`);
      }

      // Rescan after fixing
      await scanForIssues();
    } catch (error) {
      console.error('Error fixing issues:', error);
      toast.error("Failed to fix issues");
    } finally {
      setFixing(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (isAdmin === false) {
    return (
      <AdminLayout>
        <Alert variant="destructive" className="max-w-md mx-auto mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need administrator privileges to access this tool.
          </AlertDescription>
        </Alert>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Profile Repair Tool</h2>
          <p className="text-muted-foreground">Admin tool to detect and fix profile data issues</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Admin Tool</AlertTitle>
          <AlertDescription>
            This tool checks for users with missing profile data or orphaned records and automatically repairs them.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Scan Database</CardTitle>
            <CardDescription>
              Check for profile inconsistencies across all users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button 
                onClick={scanForIssues} 
                disabled={scanning || fixing}
                className="flex-1"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Scan for Issues
                  </>
                )}
              </Button>

              {issues.length > 0 && (
                <Button 
                  onClick={fixAllIssues} 
                  disabled={scanning || fixing}
                  variant="default"
                  className="flex-1"
                >
                  {fixing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Fixing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Fix All Issues ({issues.length})
                    </>
                  )}
                </Button>
              )}
            </div>

            {issues.length === 0 && !scanning && isAdmin && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertTitle>No Issues Found</AlertTitle>
                <AlertDescription>
                  Click "Scan for Issues" to check the database, or all profiles are healthy.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {issues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Found Issues ({issues.length})</CardTitle>
              <CardDescription>
                Users with incomplete profile data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {issues.map((issue) => (
                  <div 
                    key={issue.userId} 
                    className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{issue.email}</p>
                      <p className="text-xs text-muted-foreground">User ID: {issue.userId}</p>
                      <div className="flex gap-2 mt-2">
                        {issue.missingRoleRecord && (
                          <Badge variant="destructive" className="text-xs">
                            Missing {issue.role} Record
                          </Badge>
                        )}
                      </div>
                    </div>
                    {issue.role && (
                      <Badge variant="outline">{issue.role}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default ProfileRepair;

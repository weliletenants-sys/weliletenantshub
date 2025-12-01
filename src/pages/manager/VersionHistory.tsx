import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Calendar, Users, TrendingUp, Package, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface VersionData {
  id: string;
  version: string;
  deployed_at: string;
  description: string | null;
  deployed_by: string | null;
  adoptionCount: number;
  adoptionPercentage: number;
  deployer_name: string | null;
}

const VersionHistory = () => {
  const navigate = useNavigate();
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentVersion, setCurrentVersion] = useState<string>("");

  useEffect(() => {
    fetchVersionHistory();
    
    // Get current version from localStorage
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion) {
      setCurrentVersion(storedVersion);
    }
  }, []);

  const fetchVersionHistory = async () => {
    try {
      setIsLoading(true);

      // Get total user count
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      setTotalUsers(userCount || 0);

      // Get all versions with deployer info
      const { data: versionsData, error: versionsError } = await supabase
        .from('version_history')
        .select(`
          id,
          version,
          deployed_at,
          description,
          deployed_by,
          profiles!version_history_deployed_by_fkey (
            full_name
          )
        `)
        .order('deployed_at', { ascending: false });

      if (versionsError) throw versionsError;

      // For each version, get adoption count
      const versionsWithAdoption = await Promise.all(
        (versionsData || []).map(async (version) => {
          const { count: adoptionCount } = await supabase
            .from('version_adoptions')
            .select('*', { count: 'exact', head: true })
            .eq('version', version.version);

          const percentage = userCount ? ((adoptionCount || 0) / userCount) * 100 : 0;

          return {
            id: version.id,
            version: version.version,
            deployed_at: version.deployed_at,
            description: version.description,
            deployed_by: version.deployed_by,
            adoptionCount: adoptionCount || 0,
            adoptionPercentage: percentage,
            deployer_name: version.profiles?.full_name || null,
          };
        })
      );

      setVersions(versionsWithAdoption);
    } catch (error) {
      console.error('Error fetching version history:', error);
      toast.error('Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  };

  const getAdoptionColor = (percentage: number) => {
    if (percentage >= 80) return "text-emerald-600";
    if (percentage >= 50) return "text-blue-600";
    if (percentage >= 20) return "text-amber-600";
    return "text-gray-600";
  };

  const getAdoptionBadge = (percentage: number) => {
    if (percentage >= 80) return "Widespread";
    if (percentage >= 50) return "Majority";
    if (percentage >= 20) return "Growing";
    return "New";
  };

  if (isLoading) {
    return (
      <ManagerLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigate(-1);
              haptics.light();
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Version History</h1>
            <p className="text-muted-foreground">
              Track deployment history and user adoption rates
            </p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Versions</p>
                  <p className="text-2xl font-bold">{versions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Version</p>
                  <p className="text-2xl font-bold">{currentVersion || versions[0]?.version || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Version List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Deployment Timeline</h2>
          
          {versions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold mb-2">No Version History</p>
                <p className="text-muted-foreground">
                  Versions will appear here as they are deployed
                </p>
              </CardContent>
            </Card>
          ) : (
            versions.map((version, index) => (
              <Card key={version.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-2xl font-bold">
                          v{version.version}
                        </CardTitle>
                        {index === 0 && (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600">
                            Latest
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {getAdoptionBadge(version.adoptionPercentage)}
                        </Badge>
                      </div>
                      
                      <CardDescription className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(version.deployed_at), "PPP 'at' p")}
                        </span>
                        {version.deployer_name && (
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            Deployed by {version.deployer_name}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    
                    <div className="text-right">
                      <p className={`text-3xl font-bold ${getAdoptionColor(version.adoptionPercentage)}`}>
                        {version.adoptionPercentage.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {version.adoptionCount} users
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Description */}
                  {version.description && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm">{version.description}</p>
                    </div>
                  )}

                  {/* Adoption Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        Adoption Rate
                      </span>
                      <span className="font-medium">
                        {version.adoptionCount} / {totalUsers} users
                      </span>
                    </div>
                    <Progress 
                      value={version.adoptionPercentage} 
                      className="h-2"
                    />
                  </div>

                  {/* Time since deployment */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      Deployed {format(new Date(version.deployed_at), "'on' PPP")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Help Text */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">📊 How Adoption Tracking Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Users automatically log adoption when they update to a new version</li>
              <li>Adoption percentage = (Users on this version / Total users) × 100</li>
              <li>Widespread: 80%+ adoption, Majority: 50%+, Growing: 20%+</li>
              <li>Update <code className="bg-background px-1 py-0.5 rounded">public/version.json</code> before publishing to track new deployments</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default VersionHistory;
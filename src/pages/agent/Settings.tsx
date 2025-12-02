import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AgentLayout from "@/components/AgentLayout";
import { SettingsSkeleton } from "@/components/TenantDetailSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Shield, Loader2, Lock, Eye, EyeOff, RefreshCw, CheckCircle, FileText, Bell, Volume2, Vibrate, Info, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { ChangelogDialog } from "@/components/ChangelogDialog";
import { PasswordChangeRequestDialog } from "@/components/PasswordChangeRequestDialog";
import { changelog } from "@/data/changelog";
import { getNotificationPreferences, setNotificationPreferences } from "@/hooks/useNotificationAlerts";
import { useQuery } from "@tanstack/react-query";

const AgentSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [profile, setProfile] = useState({
    full_name: '',
    phone_number: '',
    role: 'agent' as 'admin' | 'agent' | 'manager',
    email: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordRequestDialogOpen, setPasswordRequestDialogOpen] = useState(false);
  
  // Version checking for manual updates
  const { isChecking, checkVersion, currentVersion } = useVersionCheck();
  const [manualCheckLoading, setManualCheckLoading] = useState(false);
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);

  // Fetch user ID
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    
    // Load notification preferences
    const preferences = getNotificationPreferences();
    setSoundEnabled(preferences.soundEnabled);
    setVibrationEnabled(preferences.vibrationEnabled);
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setUserId(user.id);

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!profileData) {
        toast.error('Profile not found. Please contact support.');
        navigate('/login');
        return;
      }

      setProfile({
        full_name: profileData.full_name || '',
        phone_number: profileData.phone_number || '',
        role: profileData.role,
        email: user.email || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Fetch agent data to get agent_id
  const { data: agentData } = useQuery({
    queryKey: ["agent-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch password change requests
  const { data: passwordRequests } = useQuery({
    queryKey: ["password-change-requests", agentData?.id],
    queryFn: async () => {
      if (!agentData?.id) return [];
      const { data, error } = await supabase
        .from("password_change_requests")
        .select("*")
        .eq("agent_id", agentData.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!agentData?.id,
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name.trim(),
          phone_number: profile.phone_number.trim(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    // Validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    try {
      setChangingPassword(true);

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) throw updateError;

      toast.success('Password changed successfully');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleNotificationPreferenceChange = (type: 'sound' | 'vibration', enabled: boolean) => {
    if (type === 'sound') {
      setSoundEnabled(enabled);
      setNotificationPreferences({ soundEnabled: enabled, vibrationEnabled });
      toast.success(enabled ? "Notification sounds enabled" : "Notification sounds disabled");
    } else {
      setVibrationEnabled(enabled);
      setNotificationPreferences({ soundEnabled, vibrationEnabled: enabled });
      toast.success(enabled ? "Notification vibration enabled" : "Notification vibration disabled");
    }
  };

  const handleManualUpdateCheck = async () => {
    setManualCheckLoading(true);
    try {
      await checkVersion();
      
      // If no update was triggered, show success message
      setTimeout(() => {
        if (!isChecking) {
          toast.success('✅ You\'re up to date!', {
            description: 'You have the latest version of the app.',
          });
        }
        setManualCheckLoading(false);
      }, 1500);
    } catch (error) {
      toast.error('Failed to check for updates');
      setManualCheckLoading(false);
    }
  };

  if (loading) {
    return (
      <AgentLayout currentPage="/agent/settings">
        <SettingsSkeleton />
      </AgentLayout>
    );
  }

  return (
    <AgentLayout currentPage="/agent/settings">
      <ChangelogDialog
        open={showChangelogDialog}
        onOpenChange={setShowChangelogDialog}
        entries={changelog}
        isUpdate={false}
      />
      
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">Manage your profile information</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </div>
              <Badge variant="default" className="gap-1">
                <Shield className="h-3 w-3" />
                Agent
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <Input
                id="phone_number"
                value={profile.phone_number}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Email (Read-only)</Label>
              <Input
                value={profile.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if you need to update it.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/agent/dashboard')}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password Management</CardTitle>
            <CardDescription>Request a password change from your manager</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Forgot Your Password?</p>
                  <p className="text-xs text-muted-foreground">
                    Submit a password change request to your manager. Once approved, you'll receive a password reset link via email.
                  </p>
                </div>
              </div>
            </div>

            {passwordRequests && passwordRequests.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Recent Requests</Label>
                <div className="space-y-2">
                  {passwordRequests.slice(0, 3).map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {req.status === "pending" && "⏳ Pending Review"}
                          {req.status === "approved" && "✅ Approved"}
                          {req.status === "rejected" && "❌ Rejected"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </p>
                        {req.status === "rejected" && req.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">{req.rejection_reason}</p>
                        )}
                      </div>
                      <Badge
                        variant={
                          req.status === "pending"
                            ? "default"
                            : req.status === "approved"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {req.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={() => setPasswordRequestDialogOpen(true)}
              className="w-full"
              disabled={passwordRequests?.some(r => r.status === "pending")}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {passwordRequests?.some(r => r.status === "pending") 
                ? "Request Pending..."
                : "Request Password Change"}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Preferences Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notification Preferences</CardTitle>
            </div>
            <CardDescription>
              Customize how you receive payment notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sound Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="sound-toggle" className="text-base cursor-pointer">
                    Notification Sounds
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Play sound alerts for payment notifications
                  </p>
                </div>
              </div>
              <Switch
                id="sound-toggle"
                checked={soundEnabled}
                onCheckedChange={(checked) => handleNotificationPreferenceChange('sound', checked)}
              />
            </div>

            <Separator />

            {/* Vibration Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Vibrate className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="vibration-toggle" className="text-base cursor-pointer">
                    Notification Vibration
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Vibrate device for payment notifications
                  </p>
                </div>
              </div>
              <Switch
                id="vibration-toggle"
                checked={vibrationEnabled}
                onCheckedChange={(checked) => handleNotificationPreferenceChange('vibration', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Security</CardTitle>
            <CardDescription>You're logged in and your session is secure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">Role</p>
                  <p className="text-xs text-muted-foreground">Your account type</p>
                </div>
                <Badge variant="secondary">{profile.role}</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">Login Method</p>
                  <p className="text-xs text-muted-foreground">How you sign in</p>
                </div>
                <Badge variant="outline">Phone</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              App Updates
            </CardTitle>
            <CardDescription>Check for the latest version and updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="space-y-1">
                <p className="text-sm font-medium">Current Version</p>
                <p className="text-xs text-muted-foreground">{currentVersion}</p>
              </div>
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Active
              </Badge>
            </div>

            <Button 
              onClick={handleManualUpdateCheck}
              disabled={manualCheckLoading || isChecking}
              className="w-full"
              variant="secondary"
            >
              {manualCheckLoading || isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check for Updates
                </>
              )}
            </Button>

            <div className="pt-2">
              <Button
                onClick={() => setShowChangelogDialog(true)}
                variant="ghost"
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Release Notes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {agentData && (
        <PasswordChangeRequestDialog
          open={passwordRequestDialogOpen}
          onOpenChange={setPasswordRequestDialogOpen}
          agentId={agentData.id}
        />
      )}
    </AgentLayout>
  );
};

export default AgentSettings;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Phone, Shield, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AgentSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    phone_number: '',
    role: 'agent' as 'admin' | 'agent' | 'manager',
    email: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

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

  if (loading) {
    return (
      <AgentLayout currentPage="/agent/settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout currentPage="/agent/settings">
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
      </div>
    </AgentLayout>
  );
};

export default AgentSettings;

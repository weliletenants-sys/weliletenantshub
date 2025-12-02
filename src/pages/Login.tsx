import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WelileLogo from "@/components/WelileLogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import { ensureProfileExists } from "@/lib/profileSync";
import { Eye, EyeOff, Shield, KeyRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role") || "agent";
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [showPasswordRequestDialog, setShowPasswordRequestDialog] = useState(false);
  const [requestStep, setRequestStep] = useState<'code' | 'phone'>('code');
  const [accessCode, setAccessCode] = useState("");
  const [requestPhoneNumber, setRequestPhoneNumber] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{
    status: string;
    requested_at: string;
  } | null>(null);
  const [checkingRequest, setCheckingRequest] = useState(false);

  // Check for forgot password parameter in URL
  useEffect(() => {
    if (searchParams.get('forgot') === 'true') {
      setShowPasswordRequestDialog(true);
    }
  }, [searchParams]);

  // Check for pending password change request
  useEffect(() => {
    const checkPendingRequest = async () => {
      if (!phoneNumber || phoneNumber.length < 10) {
        setPendingRequest(null);
        return;
      }

      setCheckingRequest(true);
      try {
        // Look up profile by phone number
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('phone_number', phoneNumber)
          .eq('role', 'agent')
          .single();

        if (!profile) {
          setPendingRequest(null);
          return;
        }

        // Get agent record
        const { data: agent } = await supabase
          .from('agents')
          .select('id')
          .eq('user_id', profile.id)
          .single();

        if (!agent) {
          setPendingRequest(null);
          return;
        }

        // Check for pending password change request
        const { data: request } = await supabase
          .from('password_change_requests')
          .select('status, requested_at')
          .eq('agent_id', agent.id)
          .eq('status', 'pending')
          .order('requested_at', { ascending: false })
          .limit(1)
          .single();

        setPendingRequest(request);
      } catch (error) {
        setPendingRequest(null);
      } finally {
        setCheckingRequest(false);
      }
    };

    const timer = setTimeout(checkPendingRequest, 500);
    return () => clearTimeout(timer);
  }, [phoneNumber]);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session);
        // Ensure profile exists before redirecting
        const profileExists = await ensureProfileExists(session.user);
        if (profileExists) {
          redirectToDashboard(session.user.user_metadata?.role || roleParam);
        } else {
          toast.error("Failed to load profile. Please try logging in again.");
          await supabase.auth.signOut();
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        // Ensure profile exists before redirecting
        const profileExists = await ensureProfileExists(session.user);
        if (profileExists) {
          redirectToDashboard(session.user.user_metadata?.role || roleParam);
        } else {
          toast.error("Failed to load profile. Please contact support.");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [roleParam, navigate]);

  const redirectToDashboard = (role: string) => {
    if (role === "manager") {
      navigate("/manager/dashboard");
    } else {
      navigate("/agent/dashboard");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Using email format for phone-based auth
      const email = `${phoneNumber}@welile.local`;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Ensure profile exists after login
        const profileExists = await ensureProfileExists(data.user);
        if (profileExists) {
          toast.success("Login successful!");
          redirectToDashboard(roleParam);
        } else {
          toast.error("Failed to load profile. Please contact support.");
          await supabase.auth.signOut();
        }
      }
    } catch (error: any) {
      // Check if it's an invalid credentials error
      if (error.message?.toLowerCase().includes('invalid') && 
          (error.message?.toLowerCase().includes('credentials') || 
           error.message?.toLowerCase().includes('login'))) {
        setShowPasswordResetDialog(true);
      } else {
        toast.error(error.message || "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Using email format for phone-based auth
      const email = `${phoneNumber}@welile.local`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone_number: phoneNumber,
            full_name: fullName,
            role: roleParam,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Ensure profile exists after signup
        const profileExists = await ensureProfileExists(data.user);
        if (profileExists) {
          toast.success("Account created successfully!");
          redirectToDashboard(roleParam);
        } else {
          toast.error("Account created but profile setup failed. Please contact support.");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordRequest = async () => {
    if (requestStep === 'code') {
      if (accessCode.trim().toUpperCase() === 'MYPART@WELILE') {
        setRequestStep('phone');
        setAccessCode("");
      } else {
        toast.error("Invalid access code. Please try again.");
      }
      return;
    }

    // Step 2: Submit phone number and create password change request
    setIsSubmittingRequest(true);
    try {
      // Look up agent by phone number
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('phone_number', requestPhoneNumber)
        .eq('role', 'agent')
        .single();

      if (profileError || !profile) {
        throw new Error("No agent found with this phone number");
      }

      // Get agent record
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (agentError || !agent) {
        throw new Error("Agent record not found");
      }

      const agentId = agent.id;

      // Create password change request
      const { error: requestError } = await supabase
        .from('password_change_requests')
        .insert({
          agent_id: agentId,
          reason: 'Password reset requested via forgot password flow',
          status: 'pending'
        });

      if (requestError) throw requestError;

      toast.success("Password change request submitted successfully! Your manager will review it shortly.");
      setShowPasswordRequestDialog(false);
      setRequestStep('code');
      setRequestPhoneNumber("");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit password change request");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <WelileLogo />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {roleParam === "manager" ? "Manager Portal" : "Agent Portal"}
            </CardTitle>
            <CardDescription className="text-center">
              Enter your phone number to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-login">Phone Number</Label>
                    <Input
                      id="phone-login"
                      type="tel"
                      placeholder="0700000000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                    {checkingRequest && phoneNumber.length >= 10 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="inline-block animate-spin">⏳</span>
                        Checking for pending requests...
                      </p>
                    )}
                    {pendingRequest && (
                      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <KeyRound className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                            Password Change Request Pending
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-200">
                            Your password change request from {new Date(pendingRequest.requested_at).toLocaleDateString()} is being reviewed by your manager.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-login">Password</Label>
                    <div className="relative">
                      <Input
                        id="password-login"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowPasswordRequestDialog(true)}
                        className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      You'll stay logged in on this device permanently
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-signup">Full Name</Label>
                    <Input
                      id="name-signup"
                      type="text"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-signup">Phone Number</Label>
                    <Input
                      id="phone-signup"
                      type="tel"
                      placeholder="0700000000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signup">Password</Label>
                    <div className="relative">
                      <Input
                        id="password-signup"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordRequestDialog(true)}
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors text-right"
                    >
                      Already have an account? Forgot Password?
                    </button>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      You'll stay logged in on this device permanently
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate("/")}
        >
          Back to Home
        </Button>
      </div>

      <AlertDialog open={showPasswordResetDialog} onOpenChange={setShowPasswordResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <AlertDialogTitle>Invalid Password</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3 text-left">
              <p className="text-base">The password you entered is incorrect.</p>
              <div className="bg-primary/10 p-4 rounded-lg space-y-2 border border-primary/20">
                <p className="font-semibold text-foreground">Forgot your password?</p>
                <p className="text-sm">Contact your manager to request a password change. They can send you a password reset link via email.</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Or try entering your password again - make sure Caps Lock is off and check for any typing errors.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Try Again</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPasswordRequestDialog} onOpenChange={(open) => {
        setShowPasswordRequestDialog(open);
        if (!open) {
          setRequestStep('code');
          setAccessCode("");
          setRequestPhoneNumber("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <AlertDialogTitle>Request Password Change</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-4 text-left">
              {requestStep === 'code' ? (
                <>
                  <p className="text-base">Enter the access code to proceed with your password change request.</p>
                  <div className="space-y-2">
                    <Label htmlFor="access-code">Access Code</Label>
                    <Input
                      id="access-code"
                      type="text"
                      placeholder="Enter access code"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the code communicated to you by your manager
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base">Enter your phone number to submit a password change request.</p>
                  <div className="space-y-2">
                    <Label htmlFor="request-phone">Phone Number</Label>
                    <Input
                      id="request-phone"
                      type="tel"
                      placeholder="0700000000"
                      value={requestPhoneNumber}
                      onChange={(e) => setRequestPhoneNumber(e.target.value)}
                    />
                  </div>
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                    <p className="text-sm text-foreground">
                      Your manager will review your request and approve a password reset link.
                    </p>
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePasswordRequest}
              disabled={isSubmittingRequest || (requestStep === 'code' ? !accessCode : !requestPhoneNumber)}
            >
              {isSubmittingRequest ? "Submitting..." : requestStep === 'code' ? "Verify Code" : "Submit Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Login;

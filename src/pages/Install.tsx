import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import WelileLogo from "@/components/WelileLogo";
import { Smartphone, Download, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      setIsInstallable(false);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <WelileLogo />
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Install Welile App</CardTitle>
            <CardDescription>
              Get instant access to your agent portal from your home screen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isInstalled ? (
              <div className="text-center space-y-4">
                <div className="mx-auto bg-success/10 w-16 h-16 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-lg mb-2">App Installed!</p>
                  <p className="text-sm text-muted-foreground">
                    You can now access Welile from your home screen
                  </p>
                </div>
                <Button className="w-full" onClick={() => navigate("/login?role=agent")}>
                  Go to Login
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 rounded-full p-2 mt-1">
                      <Download className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Works Offline</p>
                      <p className="text-sm text-muted-foreground">
                        Access your data even without internet
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 rounded-full p-2 mt-1">
                      <Smartphone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Fast & Reliable</p>
                      <p className="text-sm text-muted-foreground">
                        Lightning fast load times like a native app
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 rounded-full p-2 mt-1">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Home Screen Access</p>
                      <p className="text-sm text-muted-foreground">
                        One tap to open from your phone's home screen
                      </p>
                    </div>
                  </div>
                </div>

                {isInstallable ? (
                  <Button className="w-full" size="lg" onClick={handleInstall}>
                    <Download className="h-5 w-5 mr-2" />
                    Install App Now
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-muted p-4 rounded-lg text-sm">
                      <p className="font-medium mb-2">How to Install:</p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li>
                          <strong>iPhone:</strong> Tap the Share button, then "Add to Home
                          Screen"
                        </li>
                        <li>
                          <strong>Android:</strong> Tap the menu (⋮), then "Install app" or
                          "Add to Home screen"
                        </li>
                      </ul>
                    </div>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => navigate("/login?role=agent")}
                    >
                      Continue to Web Version
                    </Button>
                  </div>
                )}
              </>
            )}
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
    </div>
  );
};

export default Install;

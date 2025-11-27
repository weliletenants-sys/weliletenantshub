import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import WelileLogo from "@/components/WelileLogo";
import { UserCog, Users, Download } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5 flex flex-col">
      <header className="p-6 flex justify-between items-center">
        <WelileLogo />
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate("/install")}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Install App
        </Button>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="text-center max-w-2xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground">
              Agent & Service Centre Portal
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Manage your portfolio, track tenants, and grow your business
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 max-w-md mx-auto pt-8">
            <Button
              size="lg"
              className="w-full h-24 text-lg flex flex-col gap-2"
              onClick={() => navigate("/login?role=agent")}
            >
              <Users className="h-8 w-8" />
              Agent Portal
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full h-24 text-lg flex flex-col gap-2"
              onClick={() => navigate("/login?role=manager")}
            >
              <UserCog className="h-8 w-8" />
              Manager Portal
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

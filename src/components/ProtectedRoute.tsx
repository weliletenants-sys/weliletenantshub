import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "agent" | "manager" | "admin";
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?role=${requiredRole || "agent"}`} replace />;
  }

  // Check role if required
  if (requiredRole && role !== requiredRole) {
    const correctRole = role || "agent";
    return <Navigate to={`/${correctRole}/dashboard`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

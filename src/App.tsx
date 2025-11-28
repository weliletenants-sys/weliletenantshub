import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import { clearOldCaches } from "@/lib/cacheManager";
import SplashScreen from "@/components/SplashScreen";
import { InstallReminderProvider } from "@/components/InstallReminderProvider";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";

// Eagerly load critical pages
import Index from "./pages/Index";
import Login from "./pages/Login";

// Lazy load all other pages for better initial load performance
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));
const AgentDashboard = lazy(() => import("./pages/agent/Dashboard"));
const AgentTenants = lazy(() => import("./pages/agent/Tenants"));
const AgentNewTenant = lazy(() => import("./pages/agent/NewTenant"));
const AgentTenantDetail = lazy(() => import("./pages/agent/TenantDetail"));
const AgentCollections = lazy(() => import("./pages/agent/Collections"));
const AgentEarnings = lazy(() => import("./pages/agent/Earnings"));
const AgentOfflineQueue = lazy(() => import("./pages/agent/OfflineQueue"));
const AgentAIAssistant = lazy(() => import("./pages/agent/AIAssistant"));
const AgentWeeklySummary = lazy(() => import("./pages/agent/WeeklySummary"));
const AgentSettings = lazy(() => import("./pages/agent/Settings"));
const ManagerDashboard = lazy(() => import("./pages/manager/Dashboard"));
const ManagerAgents = lazy(() => import("./pages/manager/Agents"));
const ManagerAgentDetail = lazy(() => import("./pages/manager/AgentDetail"));
const ManagerTenantDetail = lazy(() => import("./pages/manager/TenantDetail"));
const ManagerPortfolioBreakdown = lazy(() => import("./pages/manager/PortfolioBreakdown"));
const ManagerAgentComparison = lazy(() => import("./pages/manager/AgentComparison"));
const ManagerWeeklyReport = lazy(() => import("./pages/manager/WeeklyReport"));
const ManagerAuditLog = lazy(() => import("./pages/manager/AuditLog"));
const ManagerVerifications = lazy(() => import("./pages/manager/Verifications"));
const ManagerPaymentVerifications = lazy(() => import("./pages/manager/PaymentVerifications"));
const ManagerVerificationHistory = lazy(() => import("./pages/manager/VerificationHistory"));
const ManagerDeliveryReports = lazy(() => import("./pages/manager/DeliveryReports"));
const ManagerSettings = lazy(() => import("./pages/manager/Settings"));
const AdminProfileRepair = lazy(() => import("./pages/admin/ProfileRepair"));
const AdminRoleManagement = lazy(() => import("./pages/admin/RoleManagement"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center p-8">
    <div className="w-full max-w-md space-y-4">
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    // Skip splash on repeat visits for faster load
    const hasShownSplash = sessionStorage.getItem('splashShown');
    return !hasShownSplash;
  });

  // Initialize cache cleanup and service worker on app start
  useEffect(() => {
    clearOldCaches();
  }, []);

  // Prefetch likely next routes based on user role
  useRoutePrefetch();

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashShown', 'true');
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {!showSplash && <InstallReminderProvider />}
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/install" element={<Install />} />
              <Route path="/agent/dashboard" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentDashboard />
                </ProtectedRoute>
              } />
              <Route path="/agent/tenants" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentTenants />
                </ProtectedRoute>
              } />
              <Route path="/agent/tenants/:tenantId" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentTenantDetail />
                </ProtectedRoute>
              } />
              <Route path="/agent/new-tenant" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentNewTenant />
                </ProtectedRoute>
              } />
              <Route path="/agent/collections" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentCollections />
                </ProtectedRoute>
              } />
              <Route path="/agent/earnings" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentEarnings />
                </ProtectedRoute>
              } />
              <Route path="/agent/offline-queue" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentOfflineQueue />
                </ProtectedRoute>
              } />
              <Route path="/agent/ai-assistant" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentAIAssistant />
                </ProtectedRoute>
              } />
              <Route path="/agent/weekly-summary" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentWeeklySummary />
                </ProtectedRoute>
              } />
              <Route path="/agent/settings" element={
                <ProtectedRoute requiredRole="agent">
                  <AgentSettings />
                </ProtectedRoute>
              } />
              <Route path="/manager/dashboard" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/manager/agents" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerAgents />
                </ProtectedRoute>
              } />
              <Route path="/manager/agents/compare" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerAgentComparison />
                </ProtectedRoute>
              } />
              <Route path="/manager/agents/:agentId" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerAgentDetail />
                </ProtectedRoute>
              } />
              <Route path="/manager/tenants/:tenantId" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerTenantDetail />
                </ProtectedRoute>
              } />
              <Route path="/manager/portfolio-breakdown" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerPortfolioBreakdown />
                </ProtectedRoute>
              } />
              <Route path="/manager/weekly-report" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerWeeklyReport />
                </ProtectedRoute>
              } />
              <Route path="/manager/audit-log" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerAuditLog />
                </ProtectedRoute>
              } />
              <Route path="/manager/verifications" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerVerifications />
                </ProtectedRoute>
              } />
              <Route path="/manager/payment-verifications" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerPaymentVerifications />
                </ProtectedRoute>
              } />
              <Route path="/manager/verification-history" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerVerificationHistory />
                </ProtectedRoute>
              } />
              <Route path="/manager/delivery-reports" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerDeliveryReports />
                </ProtectedRoute>
              } />
              <Route path="/manager/settings" element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerSettings />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/profile-repair" element={<AdminProfileRepair />} />
              <Route path="/admin/roles" element={<AdminRoleManagement />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

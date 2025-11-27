import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Install from "./pages/Install";
import AgentDashboard from "./pages/agent/Dashboard";
import AgentTenants from "./pages/agent/Tenants";
import AgentNewTenant from "./pages/agent/NewTenant";
import AgentTenantDetail from "./pages/agent/TenantDetail";
import AgentCollections from "./pages/agent/Collections";
import AgentEarnings from "./pages/agent/Earnings";
import AgentOfflineQueue from "./pages/agent/OfflineQueue";
import AgentAIAssistant from "./pages/agent/AIAssistant";
import AgentWeeklySummary from "./pages/agent/WeeklySummary";
import AgentSettings from "./pages/agent/Settings";
import ManagerDashboard from "./pages/manager/Dashboard";
import ManagerAgents from "./pages/manager/Agents";
import ManagerVerifications from "./pages/manager/Verifications";
import ManagerSettings from "./pages/manager/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/manager/verifications" element={
            <ProtectedRoute requiredRole="manager">
              <ManagerVerifications />
            </ProtectedRoute>
          } />
          <Route path="/manager/settings" element={
            <ProtectedRoute requiredRole="manager">
              <ManagerSettings />
            </ProtectedRoute>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

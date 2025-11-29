import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { AgentsListSkeleton } from "@/components/TenantDetailSkeleton";
import { VirtualizedList } from "@/components/VirtualizedList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeAgents, useRealtimeAllTenants, useRealtimeProfiles, registerSyncCallback } from "@/hooks/useRealtimeSubscription";
import { ChevronLeft, ChevronRight, Users, TrendingUp, DollarSign, Bike, Search, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Activity, Wallet, ChevronDown, Download, CheckSquare, Square, Edit, Trash2, Shield, ShieldOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkMessageDialog } from "@/components/BulkMessageDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { haptics } from "@/utils/haptics";

interface AgentWithDetails {
  id: string;
  user_id: string;
  active_tenants: number | null;
  total_tenants: number | null;
  collection_rate: number | null;
  monthly_earnings: number | null;
  portfolio_value: number | null;
  portfolio_limit: number | null;
  motorcycle_eligible: boolean | null;
  motorcycle_applied: boolean | null;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string | null;
    phone_number: string;
    role: string;
  };
  tenant_count: number;
}

interface PortfolioTrendData {
  date: string;
  value: number;
}

const ManagerAgents = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalAgents, setTotalAgents] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [motorcycleFilter, setMotorcycleFilter] = useState<string>("all");
  const [portfolioMinFilter, setPortfolioMinFilter] = useState<string>("");
  const [portfolioMaxFilter, setPortfolioMaxFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [agentPortfolioBreakdown, setAgentPortfolioBreakdown] = useState<Array<{
    agent_id: string;
    agent_name: string;
    portfolio_value: number;
    tenant_count: number;
    percentage: number;
    trend: PortfolioTrendData[];
  }>>([]);
  const [showPortfolioBreakdown, setShowPortfolioBreakdown] = useState(false);
  const [portfolioSortBy, setPortfolioSortBy] = useState<"portfolio_value" | "percentage" | "tenant_count" | "agent_name">("portfolio_value");
  const [portfolioSortDirection, setPortfolioSortDirection] = useState<"asc" | "desc">("desc");
  const [portfolioGrowthFilter, setPortfolioGrowthFilter] = useState<"all" | "positive" | "negative">("all");
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  
  // Edit/Delete state
  const [editingAgent, setEditingAgent] = useState<AgentWithDetails | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editPortfolioLimit, setEditPortfolioLimit] = useState("");
  const [deletingAgent, setDeletingAgent] = useState<AgentWithDetails | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  
  // Suspension state
  const [suspendingAgent, setSuspendingAgent] = useState<AgentWithDetails | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  
  // Enable real-time updates
  useRealtimeAgents();
  useRealtimeAllTenants();
  useRealtimeProfiles();

  const fetchAgents = async () => {
    try {
      // Fetch all tenants to calculate total portfolio value
      const { data: allTenants, error: tenantsError } = await supabase
        .from("tenants")
        .select("outstanding_balance");
      
      if (tenantsError) throw tenantsError;
      
      // Calculate total portfolio value from tenant outstanding balances
      const calculatedPortfolioValue = (allTenants || []).reduce(
        (sum, tenant) => sum + Number(tenant.outstanding_balance || 0),
        0
      );
      setTotalPortfolioValue(calculatedPortfolioValue);
      
      // Build the query for profiles search
      let profilesQuery = supabase
        .from("profiles")
        .select("id, full_name, phone_number, role")
        .eq("role", "agent");

      // Apply search filter if search query exists
      if (searchQuery.trim()) {
        profilesQuery = profilesQuery.or(
          `full_name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`
        );
      }

      const { data: matchingProfiles, error: profilesError } = await profilesQuery;
      
      if (profilesError) throw profilesError;

      const matchingUserIds = matchingProfiles?.map(p => p.id) || [];

      if (matchingUserIds.length === 0 && searchQuery.trim()) {
        // No matching profiles found
        setAgents([]);
        setTotalAgents(0);
        setLoading(false);
        return;
      }

      // Build agents query
      let agentsQuery = supabase
        .from("agents")
        .select(`
          *,
          profiles!agents_user_id_fkey (
            full_name,
            phone_number,
            role
          )
        `, { count: "exact" });

      // Apply sorting based on selected column
      if (sortColumn === "tenant_count") {
        // For tenant count, we'll sort in memory after fetching
        agentsQuery = agentsQuery.order("created_at", { ascending: sortDirection === "asc" });
      } else {
        agentsQuery = agentsQuery.order(sortColumn, { ascending: sortDirection === "asc" });
      }

      // Filter by matching user IDs if search is active
      if (searchQuery.trim() && matchingUserIds.length > 0) {
        agentsQuery = agentsQuery.in("user_id", matchingUserIds);
      }

      // Get total count
      const { count } = await agentsQuery;
      setTotalAgents(count || 0);

      // Apply pagination
      const { data: agentsData, error: agentsError } = await agentsQuery
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (agentsError) throw agentsError;

      // Fetch tenant counts and portfolio values for each agent
      const agentIds = agentsData?.map(a => a.id) || [];
      
      if (agentIds.length > 0) {
        const { data: tenantData, error: tenantsError } = await supabase
          .from("tenants")
          .select("agent_id, outstanding_balance")
          .in("agent_id", agentIds);

        if (tenantsError) throw tenantsError;

        // Count tenants and calculate portfolio value per agent
        const tenantCountMap: Record<string, number> = {};
        const portfolioValueMap: Record<string, number> = {};
        
        (tenantData || []).forEach(tenant => {
          tenantCountMap[tenant.agent_id] = (tenantCountMap[tenant.agent_id] || 0) + 1;
          portfolioValueMap[tenant.agent_id] = (portfolioValueMap[tenant.agent_id] || 0) + Number(tenant.outstanding_balance || 0);
        });

        // Fetch collections for past 7 days to calculate trend
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: collections, error: collectionsError } = await supabase
          .from("collections")
          .select("agent_id, amount, collection_date")
          .in("agent_id", agentIds)
          .gte("collection_date", sevenDaysAgo.toISOString().split('T')[0])
          .eq("status", "verified");
        
        if (collectionsError) console.error("Error fetching collections:", collectionsError);

        // Calculate 7-day trend data for each agent
        const agentTrendMap: Record<string, PortfolioTrendData[]> = {};
        
        agentIds.forEach(agentId => {
          const trend: PortfolioTrendData[] = [];
          const currentPortfolio = portfolioValueMap[agentId] || 0;
          
          // Generate data points for past 7 days
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Calculate collections from this date to today
            const collectionsFromDate = (collections || [])
              .filter(c => c.agent_id === agentId && c.collection_date >= dateStr)
              .reduce((sum, c) => sum + Number(c.amount), 0);
            
            // Approximate portfolio value = current + collections since that date
            const estimatedValue = currentPortfolio + collectionsFromDate;
            
            trend.push({
              date: dateStr,
              value: estimatedValue
            });
          }
          
          agentTrendMap[agentId] = trend;
        });

        // Merge tenant counts with agent data
        const agentsWithCounts = (agentsData || []).map(agent => ({
          ...agent,
          tenant_count: tenantCountMap[agent.id] || 0,
        }));
        
        // Build portfolio breakdown data with trends
        const breakdown = agentsWithCounts
          .map(agent => ({
            agent_id: agent.id,
            agent_name: agent.profiles?.full_name || "Unknown Agent",
            portfolio_value: portfolioValueMap[agent.id] || 0,
            tenant_count: tenantCountMap[agent.id] || 0,
            percentage: totalPortfolioValue > 0 ? ((portfolioValueMap[agent.id] || 0) / totalPortfolioValue) * 100 : 0,
            trend: agentTrendMap[agent.id] || [],
          }))
          .sort((a, b) => b.portfolio_value - a.portfolio_value);
        
        setAgentPortfolioBreakdown(breakdown);

        // Sort by tenant_count if that's the selected column
        if (sortColumn === "tenant_count") {
          agentsWithCounts.sort((a, b) => {
            const diff = a.tenant_count - b.tenant_count;
            return sortDirection === "asc" ? diff : -diff;
          });
        }

        // Apply client-side filters
        let filteredAgents = agentsWithCounts;

        // Status filter (active/inactive based on tenant count)
        if (statusFilter === "active") {
          filteredAgents = filteredAgents.filter(a => a.tenant_count > 0);
        } else if (statusFilter === "inactive") {
          filteredAgents = filteredAgents.filter(a => a.tenant_count === 0);
        }

        // Motorcycle eligibility filter
        if (motorcycleFilter === "eligible") {
          filteredAgents = filteredAgents.filter(a => a.motorcycle_eligible === true);
        } else if (motorcycleFilter === "applied") {
          filteredAgents = filteredAgents.filter(a => a.motorcycle_applied === true);
        } else if (motorcycleFilter === "not_eligible") {
          filteredAgents = filteredAgents.filter(a => !a.motorcycle_eligible);
        }

        // Portfolio value range filter
        const minPortfolio = portfolioMinFilter ? parseFloat(portfolioMinFilter) : null;
        const maxPortfolio = portfolioMaxFilter ? parseFloat(portfolioMaxFilter) : null;
        
        if (minPortfolio !== null || maxPortfolio !== null) {
          filteredAgents = filteredAgents.filter(a => {
            const portfolioValue = Number(a.portfolio_value || 0);
            if (minPortfolio !== null && portfolioValue < minPortfolio) return false;
            if (maxPortfolio !== null && portfolioValue > maxPortfolio) return false;
            return true;
          });
        }

        setAgents(filteredAgents);
        setTotalAgents(filteredAgents.length);
      } else {
        setAgents([]);
        setTotalAgents(0);
      }
    } catch (error: any) {
      toast.error("Failed to load agents");
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAgents();
  }, [currentPage, pageSize, searchQuery, sortColumn, sortDirection, statusFilter, motorcycleFilter, portfolioMinFilter, portfolioMaxFilter]);

  useEffect(() => {
    // Listen for real-time updates and refetch
    const unregisterCallback = registerSyncCallback((table) => {
      if (table === 'agents' || table === 'profiles' || table === 'tenants') {
        console.log(`Real-time update detected on ${table}, refreshing agents list`);
        fetchAgents();
      }
    });

    return () => {
      unregisterCallback();
    };
  }, [currentPage, pageSize]);

  const totalPages = Math.ceil(totalAgents / pageSize);
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalAgents);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to descending
      setSortColumn(column);
      setSortDirection("desc");
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1 inline" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 inline" />
    );
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setMotorcycleFilter("all");
    setPortfolioMinFilter("");
    setPortfolioMaxFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== "all" || motorcycleFilter !== "all" || portfolioMinFilter || portfolioMaxFilter;

  const handleSelectAll = () => {
    if (selectedAgents.size === agents.length) {
      setSelectedAgents(new Set());
    } else {
      setSelectedAgents(new Set(agents.map(a => a.id)));
    }
  };

  const handleSelectAgent = (agentId: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
  };

  const exportSelectedAgentsToCSV = () => {
    if (selectedAgents.size === 0) {
      toast.error("No agents selected", {
        description: "Please select agents to export"
      });
      return;
    }

    const selectedAgentData = agents.filter(a => selectedAgents.has(a.id));
    
    // Create CSV content
    const headers = [
      "Agent Name",
      "Phone Number",
      "Total Tenants",
      "Active Tenants",
      "Collection Rate (%)",
      "Monthly Earnings (UGX)",
      "Portfolio Value (UGX)",
      "Motorcycle Eligible",
      "Motorcycle Applied",
      "Status"
    ];
    
    const rows = selectedAgentData.map(agent => [
      agent.profiles?.full_name || "Unknown",
      agent.profiles?.phone_number || "",
      agent.tenant_count,
      agent.active_tenants || 0,
      (agent.collection_rate || 0).toFixed(2),
      (agent.monthly_earnings || 0).toFixed(2),
      (agent.portfolio_value || 0).toFixed(2),
      agent.motorcycle_eligible ? "Yes" : "No",
      agent.motorcycle_applied ? "Yes" : "No",
      agent.tenant_count > 0 ? "Active" : "Inactive"
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `agents_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Exported ${selectedAgents.size} agent(s) to CSV`);
  };

  const exportAllAgentsToCSV = () => {
    // Create CSV content for all agents
    const headers = [
      "Agent Name",
      "Phone Number",
      "Total Tenants",
      "Active Tenants",
      "Collection Rate (%)",
      "Monthly Earnings (UGX)",
      "Portfolio Value (UGX)",
      "Motorcycle Eligible",
      "Motorcycle Applied",
      "Status"
    ];
    
    const rows = agents.map(agent => [
      agent.profiles?.full_name || "Unknown",
      agent.profiles?.phone_number || "",
      agent.tenant_count,
      agent.active_tenants || 0,
      (agent.collection_rate || 0).toFixed(2),
      (agent.monthly_earnings || 0).toFixed(2),
      (agent.portfolio_value || 0).toFixed(2),
      agent.motorcycle_eligible ? "Yes" : "No",
      agent.motorcycle_applied ? "Yes" : "No",
      agent.tenant_count > 0 ? "Active" : "Inactive"
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `all_agents_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Exported ${agents.length} agent(s) to CSV`);
  };

  const clearSelection = () => {
    setSelectedAgents(new Set());
  };

  const getSelectedAgentNames = () => {
    return agents
      .filter(a => selectedAgents.has(a.id))
      .map(a => a.profiles?.full_name || "Unknown Agent");
  };

  // Edit Agent Handler
  const handleEditClick = (agent: AgentWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAgent(agent);
    setEditFullName(agent.profiles?.full_name || "");
    setEditPhoneNumber(agent.profiles?.phone_number || "");
    setEditPortfolioLimit(agent.portfolio_limit?.toString() || "20000000");
    haptics.light();
  };

  const handleSaveEdit = async () => {
    if (!editingAgent) return;

    try {
      setActionLoading(true);

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: editFullName,
          phone_number: editPhoneNumber
        })
        .eq("id", editingAgent.user_id);

      if (profileError) throw profileError;

      // Update agent portfolio limit
      const { error: agentError } = await supabase
        .from("agents")
        .update({
          portfolio_limit: parseFloat(editPortfolioLimit)
        })
        .eq("id", editingAgent.id);

      if (agentError) throw agentError;

      toast.success("Agent updated successfully");
      setEditingAgent(null);
      fetchAgents();
      haptics.success();
    } catch (error) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update agent");
      haptics.error();
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Agent Handler
  const handleDeleteClick = (agent: AgentWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingAgent(agent);
    setDeleteConfirmText("");
    setDeletionReason("");
    haptics.light();
  };

  const handleConfirmDelete = async () => {
    if (!deletingAgent || deleteConfirmText !== deletingAgent.profiles?.full_name || deletionReason.length < 10) {
      return;
    }

    try {
      setActionLoading(true);

      // Log deletion in audit trail
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: auditError } = await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "DELETE",
          table_name: "agents",
          record_id: deletingAgent.id,
          old_data: {
            ...deletingAgent,
            deletion_reason: deletionReason
          } as any,
          changed_fields: ["deleted"],
        });
        
        if (auditError) {
          console.error("Error logging audit:", auditError);
        }
      }

      // Delete agent (cascade will handle related records)
      const { error } = await supabase
        .from("agents")
        .delete()
        .eq("id", deletingAgent.id);

      if (error) throw error;

      toast.success("Agent deleted successfully");
      setDeletingAgent(null);
      setDeleteConfirmText("");
      setDeletionReason("");
      fetchAgents();
      haptics.success();
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent");
      haptics.error();
    } finally {
      setActionLoading(false);
    }
  };

  // Suspend Agent Handler
  const handleSuspendClick = (agent: AgentWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setSuspendingAgent(agent);
    setSuspensionReason("");
    haptics.light();
  };

  const handleConfirmSuspend = async () => {
    if (!suspendingAgent || suspensionReason.length < 10) {
      return;
    }

    try {
      setActionLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get manager profile for notification
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      // Update agent suspension status
      const { error } = await supabase
        .from("agents")
        .update({
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_by: user.id,
          suspension_reason: suspensionReason
        })
        .eq("id", suspendingAgent.id);

      if (error) throw error;

      // Send notification to agent
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          sender_id: user.id,
          recipient_id: suspendingAgent.user_id,
          title: "Account Suspended",
          message: `Your agent account has been suspended by ${managerProfile?.full_name || "a manager"}.\n\nReason: ${suspensionReason}\n\nPlease contact your manager for more information.`,
          priority: "high"
        });

      if (notificationError) {
        console.error("Error sending notification:", notificationError);
      }

      // Log suspension in audit trail
      const { error: auditError } = await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "UPDATE",
        table_name: "agents",
        record_id: suspendingAgent.id,
        old_data: { is_suspended: false } as any,
        new_data: { 
          is_suspended: true,
          suspension_reason: suspensionReason 
        } as any,
        changed_fields: ["is_suspended", "suspended_at", "suspended_by", "suspension_reason"],
      });

      if (auditError) {
        console.error("Error logging audit:", auditError);
      }

      toast.success("Agent suspended and notified successfully");
      setSuspendingAgent(null);
      setSuspensionReason("");
      fetchAgents();
      haptics.success();
    } catch (error) {
      console.error("Error suspending agent:", error);
      toast.error("Failed to suspend agent");
      haptics.error();
    } finally {
      setActionLoading(false);
    }
  };

  // Unsuspend Agent Handler
  const handleUnsuspend = async (agent: AgentWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setActionLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get manager profile for notification
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const { error } = await supabase
        .from("agents")
        .update({
          is_suspended: false,
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null
        })
        .eq("id", agent.id);

      if (error) throw error;

      // Send notification to agent
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          sender_id: user.id,
          recipient_id: agent.user_id,
          title: "Account Reactivated",
          message: `Your agent account has been reactivated by ${managerProfile?.full_name || "a manager"}.\n\nYou can now access your account and resume your activities. Welcome back!`,
          priority: "normal"
        });

      if (notificationError) {
        console.error("Error sending notification:", notificationError);
      }

      // Log unsuspension in audit trail
      const { error: auditError } = await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "UPDATE",
        table_name: "agents",
        record_id: agent.id,
        old_data: { is_suspended: true } as any,
        new_data: { is_suspended: false } as any,
        changed_fields: ["is_suspended"],
      });

      if (auditError) {
        console.error("Error logging audit:", auditError);
      }

      toast.success("Agent reactivated and notified successfully");
      fetchAgents();
      haptics.success();
    } catch (error) {
      console.error("Error reactivating agent:", error);
      toast.error("Failed to reactivate agent");
      haptics.error();
    } finally {
      setActionLoading(false);
    }
  };

  // Sort and filter portfolio breakdown based on selected options
  const sortedPortfolioBreakdown = [...agentPortfolioBreakdown]
    .filter((agent) => {
      // Filter by growth trend if selected
      if (portfolioGrowthFilter === "all") return true;
      
      const firstValue = agent.trend[0]?.value || 0;
      const lastValue = agent.trend[agent.trend.length - 1]?.value || 0;
      const percentChange = firstValue !== 0 
        ? ((lastValue - firstValue) / firstValue) * 100 
        : 0;
      
      if (portfolioGrowthFilter === "positive") return percentChange >= 0;
      if (portfolioGrowthFilter === "negative") return percentChange < 0;
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (portfolioSortBy) {
        case "portfolio_value":
          comparison = b.portfolio_value - a.portfolio_value;
          break;
        case "percentage":
          comparison = b.percentage - a.percentage;
          break;
        case "tenant_count":
          comparison = b.tenant_count - a.tenant_count;
          break;
        case "agent_name":
          comparison = a.agent_name.localeCompare(b.agent_name);
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort direction
      return portfolioSortDirection === "asc" ? -comparison : comparison;
    });

  // Calculate statistics from filtered agents
  const activeAgents = agents.filter(a => a.tenant_count > 0).length;
  const averageCollectionRate = agents.length > 0
    ? agents.reduce((sum, agent) => sum + Number(agent.collection_rate || 0), 0) / agents.length
    : 0;
  const totalEarnings = agents.reduce((sum, agent) => sum + Number(agent.monthly_earnings || 0), 0);

  if (loading) {
    return (
      <ManagerLayout currentPage="/manager/agents">
        <AgentsListSkeleton />
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/agents">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground">Monitor and manage all agents in your area</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeAgents} active • {totalAgents - activeAgents} inactive
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
                <Activity className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{activeAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalAgents > 0 ? ((activeAgents / totalAgents) * 100).toFixed(1) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Collection Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${averageCollectionRate >= 95 ? 'text-green-600' : averageCollectionRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                {averageCollectionRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {averageCollectionRate >= 95 ? 'Excellent' : averageCollectionRate >= 80 ? 'Good' : 'Needs improvement'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Portfolio Value</CardTitle>
                <Wallet className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {(totalPortfolioValue / 1000000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                UGX {totalPortfolioValue.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Monthly Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">UGX {totalEarnings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Combined agent commissions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Motorcycle Eligible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {agents.filter(a => a.motorcycle_eligible).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {agents.filter(a => a.motorcycle_applied).length} already applied
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agents.reduce((sum, agent) => sum + agent.tenant_count, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all agents
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Breakdown Card */}
        <Collapsible open={showPortfolioBreakdown} onOpenChange={setShowPortfolioBreakdown}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-purple-600" />
                      Portfolio Value Breakdown by Agent
                    </CardTitle>
                    <CardDescription>
                      See each agent's contribution to total portfolio value
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${showPortfolioBreakdown ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-4 border-t">
                {/* Sort and Filter Options */}
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-sm font-medium">Sort by:</label>
                  <Select value={portfolioSortBy} onValueChange={(value: any) => setPortfolioSortBy(value)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portfolio_value">Portfolio Value</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="tenant_count">Tenant Count</SelectItem>
                      <SelectItem value="agent_name">Agent Name</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPortfolioSortDirection(portfolioSortDirection === "asc" ? "desc" : "asc")}
                    className="gap-2"
                  >
                    {portfolioSortDirection === "desc" ? (
                      <>
                        <ArrowDown className="h-4 w-4" />
                        Descending
                      </>
                    ) : (
                      <>
                        <ArrowUp className="h-4 w-4" />
                        Ascending
                      </>
                    )}
                  </Button>
                  
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="text-sm font-medium">Growth:</label>
                    <Select value={portfolioGrowthFilter} onValueChange={(value: any) => setPortfolioGrowthFilter(value)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        <SelectItem value="positive">Positive ↑</SelectItem>
                        <SelectItem value="negative">Negative ↓</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Filter Results Count */}
                {portfolioGrowthFilter !== "all" && (
                  <div className="text-sm text-muted-foreground">
                    Showing {sortedPortfolioBreakdown.length} of {agentPortfolioBreakdown.length} agents with {portfolioGrowthFilter} growth trends
                  </div>
                )}

                {sortedPortfolioBreakdown.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {portfolioGrowthFilter !== "all" 
                      ? `No agents with ${portfolioGrowthFilter} growth trends` 
                      : "No agents with portfolio data"}
                  </p>
                ) : (
                   sortedPortfolioBreakdown.map((agent) => (
                    <div 
                      key={agent.agent_id}
                      className="space-y-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/manager/agents/${agent.agent_id}`)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{agent.agent_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {agent.tenant_count} tenant{agent.tenant_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        
                        {/* 7-Day Trend Sparkline */}
                        {agent.trend.length > 0 && (() => {
                          const firstValue = agent.trend[0]?.value || 0;
                          const lastValue = agent.trend[agent.trend.length - 1]?.value || 0;
                          const percentChange = firstValue !== 0 
                            ? ((lastValue - firstValue) / firstValue) * 100 
                            : 0;
                          const isPositive = percentChange >= 0;
                          
                          return (
                            <div className="flex flex-col items-center">
                              <ResponsiveContainer width={80} height={30}>
                                <LineChart data={agent.trend}>
                                  <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke={isPositive ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"} 
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {isPositive ? (
                                  <ArrowUp className="h-3 w-3 text-chart-2" />
                                ) : (
                                  <ArrowDown className="h-3 w-3 text-destructive" />
                                )}
                                <p className={`text-xs font-medium ${isPositive ? 'text-chart-2' : 'text-destructive'}`}>
                                  {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                        
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            UGX {agent.portfolio_value.toLocaleString()}
                          </p>
                          <p className="text-sm text-purple-600 font-medium">
                            {agent.percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      </div>
                      <Progress 
                        value={agent.percentage} 
                        className="h-2"
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => navigate("/manager/agents/compare")}
            >
              Compare Agents
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate("/manager/suspension-history")}
            >
              <Shield className="h-4 w-4 mr-2" />
              Suspension History
            </Button>
          <Button 
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                Active
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button 
              variant="ghost"
              onClick={clearFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filter Agents</CardTitle>
              <CardDescription>Refine your agent list by status, motorcycle eligibility, or portfolio value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="inactive">Inactive Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Motorcycle Eligibility Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Motorcycle Status</label>
                  <Select value={motorcycleFilter} onValueChange={setMotorcycleFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="eligible">Eligible</SelectItem>
                      <SelectItem value="applied">Applied</SelectItem>
                      <SelectItem value="not_eligible">Not Eligible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Portfolio Min Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Min Portfolio (UGX)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 1000000"
                    value={portfolioMinFilter}
                    onChange={(e) => setPortfolioMinFilter(e.target.value)}
                  />
                </div>

                {/* Portfolio Max Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Max Portfolio (UGX)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 20000000"
                    value={portfolioMaxFilter}
                    onChange={(e) => setPortfolioMaxFilter(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bulk Actions Toolbar */}
        {selectedAgents.size > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BulkMessageDialog 
                    selectedAgentIds={Array.from(selectedAgents)}
                    agentNames={getSelectedAgentNames()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportSelectedAgentsToCSV}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>All Agents</CardTitle>
                <CardDescription>
                  Total: {totalAgents} agent{totalAgents !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="flex gap-2 items-center w-full md:w-auto">
                <div className="relative flex-1 md:flex-initial md:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportAllAgentsToCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Export All ({agents.length})
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={exportSelectedAgentsToCSV}
                      disabled={selectedAgents.size === 0}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Export Selected ({selectedAgents.size})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedAgents.size === agents.length && agents.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all agents"
                      />
                    </TableHead>
                    <TableHead>Agent Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("tenant_count")}
                    >
                      <Users className="h-4 w-4 inline mr-1" />
                      Tenants
                      <SortIcon column="tenant_count" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("collection_rate")}
                    >
                      <TrendingUp className="h-4 w-4 inline mr-1" />
                      Collection Rate
                      <SortIcon column="collection_rate" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("monthly_earnings")}
                    >
                      <DollarSign className="h-4 w-4 inline mr-1" />
                      Monthly Earnings
                      <SortIcon column="monthly_earnings" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("portfolio_value")}
                    >
                      <DollarSign className="h-4 w-4 inline mr-1" />
                      Portfolio Value
                      <SortIcon column="portfolio_value" />
                    </TableHead>
                    <TableHead><Bike className="h-4 w-4 inline mr-1" />Motorcycle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading agents...
                      </TableCell>
                    </TableRow>
                  ) : agents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No agents found
                      </TableCell>
                    </TableRow>
                  ) : (
                    agents.map((agent) => (
                      <TableRow 
                        key={agent.id} 
                        className="hover:bg-muted/50"
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedAgents.has(agent.id)}
                            onCheckedChange={() => handleSelectAgent(agent.id)}
                            aria-label={`Select ${agent.profiles?.full_name || 'agent'}`}
                          />
                        </TableCell>
                        <TableCell 
                          className="font-medium cursor-pointer"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          {agent.profiles?.full_name || 'Unknown Agent'}
                        </TableCell>
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          {agent.profiles?.phone_number || '-'}
                        </TableCell>
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          <Badge variant="outline">
                            {agent.tenant_count} tenant{agent.tenant_count !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          <span className={Number(agent.collection_rate || 0) >= 95 ? "text-green-600 font-medium" : "text-yellow-600"}>
                            {Number(agent.collection_rate || 0).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell 
                          className="font-medium cursor-pointer"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          UGX {Number(agent.monthly_earnings || 0).toLocaleString()}
                        </TableCell>
                        <TableCell 
                          className="font-medium cursor-pointer"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          <div className="flex flex-col">
                            <span>UGX {Number(agent.portfolio_value || 0).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">
                              / {Number(agent.portfolio_limit || 0).toLocaleString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          {agent.motorcycle_eligible ? (
                            agent.motorcycle_applied ? (
                              <Badge className="bg-green-600">Applied</Badge>
                            ) : (
                              <Badge className="bg-blue-600">Eligible</Badge>
                            )
                          ) : (
                            <Badge variant="secondary">Not Eligible</Badge>
                          )}
                        </TableCell>
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => navigate(`/manager/agents/${agent.id}`)}
                        >
                          <div className="flex flex-col gap-1">
                            {(agent as any).is_suspended ? (
                              <Badge variant="destructive" className="w-fit">
                                Suspended
                              </Badge>
                            ) : (
                              <Badge variant={agent.tenant_count > 0 ? "default" : "secondary"}>
                                {agent.tenant_count > 0 ? "Active" : "Inactive"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {(agent as any).is_suspended ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleUnsuspend(agent, e)}
                                disabled={actionLoading}
                                className="text-success"
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleSuspendClick(agent, e)}
                                disabled={actionLoading}
                                className="text-orange-600"
                              >
                                Suspend
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleEditClick(agent, e)}
                              disabled={actionLoading}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDeleteClick(agent, e)}
                              disabled={actionLoading}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {!loading && totalAgents > 0 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    Showing {startRecord} to {endRecord} of {totalAgents} agents
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Agent Dialog */}
      <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update agent information and settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Full Name</Label>
              <Input
                id="edit-full-name"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Agent full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone-number">Phone Number</Label>
              <Input
                id="edit-phone-number"
                value={editPhoneNumber}
                onChange={(e) => setEditPhoneNumber(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-portfolio-limit">Portfolio Limit (UGX)</Label>
              <Input
                id="edit-portfolio-limit"
                type="number"
                value={editPortfolioLimit}
                onChange={(e) => setEditPortfolioLimit(e.target.value)}
                placeholder="20000000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingAgent(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={actionLoading || !editFullName || !editPhoneNumber}
            >
              {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Dialog */}
      <AlertDialog open={!!deletingAgent} onOpenChange={(open) => !open && setDeletingAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the agent and all their associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type agent name to confirm: <strong>{deletingAgent?.profiles?.full_name}</strong>
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type agent name here"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletion-reason">
                Reason for deletion <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="deletion-reason"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Provide a detailed reason (minimum 10 characters)"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {deletionReason.length}/10 characters minimum
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={
                actionLoading ||
                deleteConfirmText !== deletingAgent?.profiles?.full_name ||
                deletionReason.length < 10
              }
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? "Deleting..." : "Delete Agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Agent Dialog */}
      <AlertDialog open={!!suspendingAgent} onOpenChange={(open) => !open && setSuspendingAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Suspending an agent will temporarily disable their account. They won't be able to log in or perform any actions until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-2">Agent: {suspendingAgent?.profiles?.full_name}</p>
              <p className="text-sm text-muted-foreground">
                This action is reversible. You can reactivate the agent at any time.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suspension-reason">
                Reason for suspension <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="suspension-reason"
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="Provide a detailed reason (minimum 10 characters)"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {suspensionReason.length}/10 characters minimum
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSuspend}
              disabled={actionLoading || suspensionReason.length < 10}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {actionLoading ? "Suspending..." : "Suspend Agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagerLayout>
  );
};

export default ManagerAgents;

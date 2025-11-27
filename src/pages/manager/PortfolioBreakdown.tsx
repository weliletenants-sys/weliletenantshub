import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Wallet, Users, TrendingUp, Search, User, Phone, DollarSign, ChevronRight, ChevronLeft, Download, FileDown, Calendar as CalendarIcon, X, Star, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import { haptics } from "@/utils/haptics";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";

interface TenantData {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  outstanding_balance: number;
  status: string;
}

interface AgentPortfolio {
  id: string;
  name: string;
  phone: string;
  tenants: TenantData[];
  totalPortfolioValue: number;
  activeTenants: number;
}

const ManagerPortfolioBreakdown = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agentPortfolios, setAgentPortfolios] = useState<AgentPortfolio[]>([]);
  const [filteredPortfolios, setFilteredPortfolios] = useState<AgentPortfolio[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [totalTenants, setTotalTenants] = useState(0);
  const [openAgents, setOpenAgents] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [savedRanges, setSavedRanges] = useState<Array<{ name: string; startDate: string; endDate: string }>>([]);
  const [rangeName, setRangeName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [tenantPages, setTenantPages] = useState<Record<string, number>>({});
  const [tenantPageSizes, setTenantPageSizes] = useState<Record<string, number>>({});
  const [jumpToPageInputs, setJumpToPageInputs] = useState<Record<string, string>>({});
  const defaultPageSize = 10;

  // Load saved ranges from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('portfolio-saved-date-ranges');
    if (saved) {
      try {
        setSavedRanges(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved date ranges', e);
      }
    }
  }, []);

  const fetchPortfolioBreakdown = async () => {
    try {
      setLoading(true);

      // Fetch all agents with their profiles
      const { data: agents, error: agentsError } = await supabase
        .from("agents")
        .select(`
          id,
          user_id,
          profiles:user_id (
            full_name,
            phone_number
          )
        `);

      if (agentsError) throw agentsError;

      // Fetch all tenants with optional date filtering
      let tenantsQuery = supabase
        .from("tenants")
        .select("*")
        .order("tenant_name");

      // Apply date range filters if set
      if (startDate) {
        tenantsQuery = tenantsQuery.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        tenantsQuery = tenantsQuery.lte("created_at", endOfDay.toISOString());
      }

      const { data: tenants, error: tenantsError } = await tenantsQuery;

      if (tenantsError) throw tenantsError;

      // Build agent portfolios
      const portfolios: AgentPortfolio[] = agents?.map(agent => {
        const agentTenants = tenants?.filter(t => t.agent_id === agent.id) || [];
        const portfolioValue = agentTenants.reduce(
          (sum, t) => sum + (parseFloat(t.outstanding_balance?.toString() || '0')),
          0
        );

        return {
          id: agent.id,
          name: agent.profiles?.full_name || "Unknown Agent",
          phone: agent.profiles?.phone_number || "",
          tenants: agentTenants,
          totalPortfolioValue: portfolioValue,
          activeTenants: agentTenants.length,
        };
      }) || [];

      // Sort by portfolio value (highest first)
      portfolios.sort((a, b) => b.totalPortfolioValue - a.totalPortfolioValue);

      setAgentPortfolios(portfolios);
      setFilteredPortfolios(portfolios);

      // Calculate totals
      const totalValue = portfolios.reduce((sum, p) => sum + p.totalPortfolioValue, 0);
      const totalTenantsCount = portfolios.reduce((sum, p) => sum + p.activeTenants, 0);

      setTotalPortfolioValue(totalValue);
      setTotalTenants(totalTenantsCount);
    } catch (error: any) {
      console.error("Error fetching portfolio breakdown:", error);
      toast.error("Failed to load portfolio breakdown");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioBreakdown();
  }, [startDate, endDate]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = agentPortfolios.filter(
        portfolio =>
          portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          portfolio.phone.includes(searchQuery) ||
          portfolio.tenants.some(
            t =>
              t.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.tenant_phone.includes(searchQuery)
          )
      );
      setFilteredPortfolios(filtered);
    } else {
      setFilteredPortfolios(agentPortfolios);
    }
  }, [searchQuery, agentPortfolios]);

  const toggleAgent = (agentId: string) => {
    haptics.light();
    setOpenAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    haptics.light();
    toast.success("Date filters cleared");
  };

  const setPresetDateRange = (days: number, label: string) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start);
    setEndDate(end);
    haptics.light();
    toast.success(`Date range set to ${label}`);
  };

  const saveCurrentRange = () => {
    if (!startDate || !endDate || !rangeName.trim()) {
      toast.error("Please select dates and enter a name");
      return;
    }

    const newRange = {
      name: rangeName.trim(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };

    const updatedRanges = [...savedRanges, newRange];
    setSavedRanges(updatedRanges);
    localStorage.setItem('portfolio-saved-date-ranges', JSON.stringify(updatedRanges));
    
    setRangeName("");
    setSaveDialogOpen(false);
    haptics.light();
    toast.success(`Saved date range: ${newRange.name}`);
  };

  const loadSavedRange = (range: { name: string; startDate: string; endDate: string }) => {
    setStartDate(new Date(range.startDate));
    setEndDate(new Date(range.endDate));
    haptics.light();
    toast.success(`Loaded date range: ${range.name}`);
  };

  const deleteSavedRange = (index: number) => {
    const updatedRanges = savedRanges.filter((_, i) => i !== index);
    setSavedRanges(updatedRanges);
    localStorage.setItem('portfolio-saved-date-ranges', JSON.stringify(updatedRanges));
    haptics.light();
    toast.success("Date range deleted");
  };

  const getTenantPage = (agentId: string) => {
    return tenantPages[agentId] || 1;
  };

  const setTenantPage = (agentId: string, page: number) => {
    setTenantPages(prev => ({ ...prev, [agentId]: page }));
  };

  const getTenantPageSize = (agentId: string) => {
    return tenantPageSizes[agentId] || defaultPageSize;
  };

  const setTenantPageSize = (agentId: string, size: number) => {
    setTenantPageSizes(prev => ({ ...prev, [agentId]: size }));
    // Reset to page 1 when changing page size
    setTenantPage(agentId, 1);
  };

  const handleJumpToPage = (agentId: string, totalPages: number) => {
    const inputValue = jumpToPageInputs[agentId] || "";
    
    // Validate input using zod
    const pageSchema = z.number().int().min(1).max(totalPages);
    
    try {
      const pageNumber = parseInt(inputValue, 10);
      
      if (isNaN(pageNumber)) {
        toast.error("Please enter a valid page number");
        return;
      }
      
      const validatedPage = pageSchema.parse(pageNumber);
      setTenantPage(agentId, validatedPage);
      setJumpToPageInputs(prev => ({ ...prev, [agentId]: "" }));
      haptics.success();
      toast.success(`Jumped to page ${validatedPage}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(`Page must be between 1 and ${totalPages}`);
      } else {
        toast.error("Invalid page number");
      }
    }
  };

  const updateJumpToPageInput = (agentId: string, value: string) => {
    // Only allow digits and limit to reasonable length
    const sanitized = value.replace(/[^0-9]/g, "").slice(0, 5);
    setJumpToPageInputs(prev => ({ ...prev, [agentId]: sanitized }));
  };

  const getPaginatedTenants = (tenants: TenantData[], agentId: string) => {
    const currentPage = getTenantPage(agentId);
    const pageSize = getTenantPageSize(agentId);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return {
      tenants: tenants.slice(startIndex, endIndex),
      totalPages: Math.ceil(tenants.length / pageSize),
      currentPage,
      pageSize,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, tenants.length),
      totalTenants: tenants.length,
    };
  };

  const getDateRangeLabel = () => {
    if (startDate && endDate) {
      return `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`;
    } else if (startDate) {
      return `From ${format(startDate, "MMM d, yyyy")}`;
    } else if (endDate) {
      return `Until ${format(endDate, "MMM d, yyyy")}`;
    }
    return "All Time";
  };

  const exportPortfolioCSV = () => {
    const csvRows = [];
    
    // CSV Headers with date range
    csvRows.push([`"Portfolio Breakdown Report - ${getDateRangeLabel()}"`]);
    csvRows.push([`"Generated: ${new Date().toLocaleString()}"`]);
    csvRows.push([""]);
    csvRows.push([
      "Agent Name",
      "Agent Phone",
      "Total Tenants",
      "Portfolio Value (UGX)",
      "Tenant Name",
      "Tenant Phone",
      "Status",
      "Outstanding Balance (UGX)"
    ].join(","));

    // Add data rows
    filteredPortfolios.forEach(portfolio => {
      if (portfolio.tenants.length === 0) {
        // Agent with no tenants
        csvRows.push([
          `"${portfolio.name}"`,
          `"${portfolio.phone}"`,
          portfolio.activeTenants,
          portfolio.totalPortfolioValue,
          '""',
          '""',
          '""',
          '""'
        ].join(","));
      } else {
        // Agent with tenants
        portfolio.tenants.forEach((tenant, idx) => {
          csvRows.push([
            idx === 0 ? `"${portfolio.name}"` : '""',
            idx === 0 ? `"${portfolio.phone}"` : '""',
            idx === 0 ? portfolio.activeTenants : '""',
            idx === 0 ? portfolio.totalPortfolioValue : '""',
            `"${tenant.tenant_name}"`,
            `"${tenant.tenant_phone}"`,
            `"${tenant.status}"`,
            parseFloat(tenant.outstanding_balance?.toString() || "0")
          ].join(","));
        });
      }
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateLabel = startDate || endDate ? `-${format(startDate || new Date(), "yyyy-MM-dd")}-to-${format(endDate || new Date(), "yyyy-MM-dd")}` : "";
    link.download = `portfolio-breakdown${dateLabel}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    haptics.success();
    toast.success("Portfolio breakdown exported as CSV");
  };

  const exportPortfolioPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Portfolio Breakdown Report", margin, yPosition);
    yPosition += 10;

    // Date and summary
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Period: ${getDateRangeLabel()}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Total Portfolio Value: UGX ${totalPortfolioValue.toLocaleString()}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Total Agents: ${filteredPortfolios.length}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Total Tenants: ${totalTenants}`, margin, yPosition);
    yPosition += 12;

    // Agent details
    filteredPortfolios.forEach((portfolio, agentIndex) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }

      // Agent header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${agentIndex + 1}. ${portfolio.name}`, margin, yPosition);
      yPosition += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Phone: ${portfolio.phone}`, margin + 5, yPosition);
      yPosition += 5;
      doc.text(`Portfolio Value: UGX ${portfolio.totalPortfolioValue.toLocaleString()}`, margin + 5, yPosition);
      yPosition += 5;
      doc.text(`Total Tenants: ${portfolio.activeTenants}`, margin + 5, yPosition);
      yPosition += 8;

      // Tenant table header
      if (portfolio.tenants.length > 0) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const col1 = margin + 10;
        const col2 = col1 + 50;
        const col3 = col2 + 35;
        const col4 = col3 + 25;

        doc.text("Tenant Name", col1, yPosition);
        doc.text("Phone", col2, yPosition);
        doc.text("Status", col3, yPosition);
        doc.text("Balance (UGX)", col4, yPosition);
        yPosition += 5;

        // Tenant rows
        doc.setFont("helvetica", "normal");
        portfolio.tenants.forEach((tenant) => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = margin;
          }

          const tenantName = tenant.tenant_name.length > 20 
            ? tenant.tenant_name.substring(0, 20) + "..." 
            : tenant.tenant_name;
          
          doc.text(tenantName, col1, yPosition);
          doc.text(tenant.tenant_phone, col2, yPosition);
          doc.text(tenant.status, col3, yPosition);
          doc.text(parseFloat(tenant.outstanding_balance?.toString() || "0").toLocaleString(), col4, yPosition);
          yPosition += 5;
        });
      } else {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("No tenants assigned", margin + 10, yPosition);
        yPosition += 5;
      }

      yPosition += 8;
    });

    const dateLabel = startDate || endDate ? `-${format(startDate || new Date(), "yyyy-MM-dd")}-to-${format(endDate || new Date(), "yyyy-MM-dd")}` : "";
    doc.save(`portfolio-breakdown${dateLabel}-${new Date().toISOString().split("T")[0]}.pdf`);
    
    haptics.success();
    toast.success("Portfolio breakdown exported as PDF");
  };

  if (loading) {
    return (
      <ManagerLayout currentPage="/manager/dashboard">
        <div className="space-y-6 pb-20 md:pb-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout currentPage="/manager/dashboard">
      <div className="space-y-6 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/manager/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Portfolio Breakdown</h1>
              <p className="text-muted-foreground">
                Detailed view of agents and tenant portfolios
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Total Portfolio Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                UGX {totalPortfolioValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all agents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agentPortfolios.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Managing tenants
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTenants}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active across platform
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Date Range Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Date Range Filter
            </CardTitle>
            <CardDescription>
              Filter portfolio data by tenant registration date range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      disabled={(date) => date > new Date() || (endDate ? date > endDate : false)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => date > new Date() || (startDate ? date < startDate : false)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {(startDate || endDate) && (
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={clearDateFilters}
                    className="h-10 w-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {(startDate || endDate) && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Active Filter:</p>
                <p className="text-sm text-muted-foreground">{getDateRangeLabel()}</p>
              </div>
            )}

            {/* Preset Date Range Buttons */}
            <div className="mt-6 border-t pt-4">
              <label className="text-sm font-medium mb-3 block">Quick Filters</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPresetDateRange(7, "Last 7 Days")}
                  className="w-full"
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPresetDateRange(30, "Last 30 Days")}
                  className="w-full"
                >
                  Last 30 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPresetDateRange(90, "Last Quarter")}
                  className="w-full"
                >
                  Last Quarter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPresetDateRange(365, "Last Year")}
                  className="w-full"
                >
                  Last Year
                </Button>
              </div>
            </div>

            {/* Save Current Range */}
            {startDate && endDate && (
              <div className="mt-4 border-t pt-4">
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <Star className="w-4 h-4 mr-2" />
                      Save Current Range as Favorite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save Date Range</DialogTitle>
                      <DialogDescription>
                        Give this date range a name to quickly access it later.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="range-name">Range Name</Label>
                        <Input
                          id="range-name"
                          placeholder="e.g., Q1 2024, Summer Period"
                          value={rangeName}
                          onChange={(e) => setRangeName(e.target.value)}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>From: {format(startDate, "PPP")}</p>
                        <p>To: {format(endDate, "PPP")}</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveCurrentRange}>
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Saved Ranges */}
            {savedRanges.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <label className="text-sm font-medium mb-3 block">Saved Favorites</label>
                <div className="space-y-2">
                  {savedRanges.map((range, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadSavedRange(range)}
                        className="flex-1 justify-start text-left h-auto py-2"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{range.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(range.startDate), "PP")} - {format(new Date(range.endDate), "PP")}
                          </span>
                        </div>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSavedRange(index)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search and Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search Agents or Tenants
                </CardTitle>
                <CardDescription>
                  Filter by agent name, phone, tenant name, or tenant phone
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportPortfolioCSV}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportPortfolioPDF}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-base"
            />
          </CardContent>
        </Card>

        {/* Agent Portfolios */}
        <div className="space-y-4">
          {filteredPortfolios.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No agents found matching your search</p>
              </CardContent>
            </Card>
          ) : (
            filteredPortfolios.map((portfolio, index) => (
              <Collapsible
                key={portfolio.id}
                open={openAgents.has(portfolio.id)}
                onOpenChange={() => toggleAgent(portfolio.id)}
              >
                <Card className="border-2 hover:border-primary/40 transition-colors">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-left">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg">
                            #{index + 1}
                          </div>
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <User className="h-5 w-5" />
                              {portfolio.name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Phone className="h-4 w-4" />
                              {portfolio.phone}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <p className="text-sm text-muted-foreground">Portfolio Value</p>
                            <p className="text-xl font-bold text-primary">
                              UGX {portfolio.totalPortfolioValue.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Tenants</p>
                            <p className="text-xl font-bold">{portfolio.activeTenants}</p>
                          </div>
                          <Button variant="ghost" size="icon" asChild>
                            <div>
                              <ChevronRight
                                className={`h-5 w-5 transition-transform ${
                                  openAgents.has(portfolio.id) ? "rotate-90" : ""
                                }`}
                              />
                            </div>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 border-t">
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-sm text-muted-foreground">
                            Tenant List ({portfolio.tenants.length})
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/manager/agents/${portfolio.id}`);
                            }}
                          >
                            View Agent Details
                          </Button>
                        </div>

                        {portfolio.tenants.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No tenants assigned to this agent
                          </p>
                        ) : (
                          <>
                            {(() => {
                              const paginationData = getPaginatedTenants(portfolio.tenants, portfolio.id);
                              return (
                                <>
                                  {paginationData.tenants.map((tenant) => (
                                    <div
                                      key={tenant.id}
                                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        haptics.light();
                                        navigate(`/manager/tenants/${tenant.id}`);
                                      }}
                                    >
                                      <div className="flex-1">
                                        <p className="font-medium">{tenant.tenant_name}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                          <Phone className="h-3 w-3" />
                                          {tenant.tenant_phone}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <Badge
                                          variant={
                                            tenant.status === "verified"
                                              ? "default"
                                              : tenant.status === "pending"
                                              ? "secondary"
                                              : "outline"
                                          }
                                          className="mb-1"
                                        >
                                          {tenant.status}
                                        </Badge>
                                        <p className="text-sm font-semibold flex items-center gap-1 justify-end">
                                          <DollarSign className="h-4 w-4 text-primary" />
                                          UGX {parseFloat(tenant.outstanding_balance?.toString() || "0").toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Pagination Controls */}
                                  {paginationData.totalPages > 1 && (
                                    <div className="flex flex-col gap-4 pt-4 mt-4 border-t">
                                      <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div className="flex items-center gap-4">
                                          <div className="text-sm text-muted-foreground">
                                            Showing {paginationData.startIndex} to {paginationData.endIndex} of {paginationData.totalTenants} tenants
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">Per page:</span>
                                            <Select
                                              value={paginationData.pageSize.toString()}
                                              onValueChange={(value) => {
                                                setTenantPageSize(portfolio.id, parseInt(value));
                                                haptics.light();
                                              }}
                                            >
                                              <SelectTrigger className="w-20 h-8 bg-background">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="bg-background z-50">
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
                                            Page {paginationData.currentPage} of {paginationData.totalPages}
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTenantPage(portfolio.id, paginationData.currentPage - 1);
                                              haptics.light();
                                            }}
                                            disabled={paginationData.currentPage === 1}
                                          >
                                            <ChevronLeft className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTenantPage(portfolio.id, paginationData.currentPage + 1);
                                              haptics.light();
                                            }}
                                            disabled={paginationData.currentPage === paginationData.totalPages}
                                          >
                                            <ChevronRight className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      {/* Jump to Page */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Jump to page:</span>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          placeholder="Page #"
                                          value={jumpToPageInputs[portfolio.id] || ""}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            updateJumpToPageInput(portfolio.id, e.target.value);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleJumpToPage(portfolio.id, paginationData.totalPages);
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-24 h-8"
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleJumpToPage(portfolio.id, paginationData.totalPages);
                                          }}
                                          disabled={!jumpToPageInputs[portfolio.id]}
                                        >
                                          Go
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </div>
      </div>
    </ManagerLayout>
  );
};

export default ManagerPortfolioBreakdown;

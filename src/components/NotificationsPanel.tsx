import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, X, AlertCircle, Info, AlertTriangle, Zap, Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarIcon, Search, XCircle, Send, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { useOptimisticPayment } from "@/hooks/useOptimisticPayment";
import { useQueryClient } from "@tanstack/react-query";
import PaymentReceipt from "./PaymentReceipt";
import { useRealtimeNotifications } from "@/hooks/useRealtimeSubscription";
import MessageThreadDialog from "./MessageThreadDialog";
import { useNotificationAlerts } from "@/hooks/useNotificationAlerts";
import { haptics } from "@/utils/haptics";

interface Notification {
  id: string;
  sender_id: string;
  recipient_id: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  read: boolean;
  read_at: string | null;
  created_at: string;
  parent_notification_id: string | null;
  payment_data?: {
    tenant_id: string;
    tenant_name: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    applied: boolean;
  };
  profiles?: {
    full_name: string | null;
  };
}

export const NotificationsPanel = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [applyingPayment, setApplyingPayment] = useState<string | null>(null);
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState<"all" | "payment" | "message" | "system">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [quickReplyText, setQuickReplyText] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [tenantStatuses, setTenantStatuses] = useState<Record<string, { status: string; outstanding_balance: number }>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    today: false,
    yesterday: false,
    thisWeek: false,
    older: false
  });
  const observerTarget = useRef<HTMLDivElement>(null);
  const [receiptData, setReceiptData] = useState<{
    paymentData: {
      amount: number;
      commission: number;
      collectionDate: string;
      paymentMethod: string;
    };
    tenantData: {
      tenant_name: string;
      tenant_phone: string;
      rent_amount: number;
      outstanding_balance: number;
    };
    agentData: {
      agent_name: string;
      agent_phone: string;
    };
    receiptNumber: string;
  } | null>(null);
  
  const optimisticPayment = useOptimisticPayment();
  const { playPaymentAlert, vibrateForPayment } = useNotificationAlerts();
  
  // Enable realtime subscription for notifications
  useRealtimeNotifications();

  // Track previous notification count to detect new notifications
  const prevNotificationCountRef = useRef<number>(0);

  // Detect new payment notifications and trigger alerts
  useEffect(() => {
    const currentPaymentCount = notifications.filter(n => n.payment_data && !n.read).length;
    const prevPaymentCount = prevNotificationCountRef.current;

    // If we have new unread payment notifications, play alert
    if (currentPaymentCount > prevPaymentCount && prevPaymentCount > 0) {
      playPaymentAlert();
      vibrateForPayment();
    }

    prevNotificationCountRef.current = currentPaymentCount;
  }, [notifications, playPaymentAlert, vibrateForPayment]);

  const fetchNotifications = async (pageNum = 0, append = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const pageSize = 20;
      const from = pageNum * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          profiles!notifications_sender_id_fkey (
            full_name
          )
        `)
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const newData = (data || []) as unknown as Notification[];
      
      if (append) {
        setNotifications(prev => [...prev, ...newData]);
      } else {
        setNotifications(newData);
      }
      
      setHasMore(newData.length === pageSize);
      
      // Update unread count only on initial load
      if (!append) {
        setUnreadCount(newData.filter(n => !n.read).length);
      }
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, true);
    }
  }, [page, loading, hasMore]);

  useEffect(() => {
    if (open) {
      setPage(0);
      setNotifications([]);
      setHasMore(true);
      fetchNotifications(0, false);
    }
  }, [open]);

  // Filter and sort notifications - payment notifications first (priority)
  const filteredNotifications = notifications
    .filter(notification => {
      // Type filter
      if (filterType === "all") {
        // Continue to other filters
      } else if (filterType === "payment" && notification.payment_data === null) {
        return false;
      } else if (filterType === "message" && (notification.payment_data !== null || notification.parent_notification_id !== null)) {
        return false;
      } else if (filterType === "system" && notification.sender_id !== notification.recipient_id) {
        return false;
      }
      
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = notification.title.toLowerCase().includes(query);
        const matchesMessage = notification.message.toLowerCase().includes(query);
        const matchesSender = notification.profiles?.full_name?.toLowerCase().includes(query);
        const matchesTenant = notification.payment_data?.tenant_name?.toLowerCase().includes(query);
        
        if (!matchesTitle && !matchesMessage && !matchesSender && !matchesTenant) {
          return false;
        }
      }
      
      // Date range filter
      const notificationDate = new Date(notification.created_at);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (notificationDate < fromDate) {
          return false;
        }
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (notificationDate > toDate) {
          return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort payment notifications first (priority)
      const aIsPayment = a.payment_data !== null ? 1 : 0;
      const bIsPayment = b.payment_data !== null ? 1 : 0;
      
      if (aIsPayment !== bIsPayment) {
        return bIsPayment - aIsPayment; // Payment notifications first
      }
      
      // Then sort by date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setFilterType("all");
  };

  const handleQuickReply = async (notificationId: string, recipientId: string) => {
    const replyText = quickReplyText[notificationId]?.trim();
    
    if (!replyText) {
      toast.error("Reply message cannot be empty");
      return;
    }

    if (replyText.length > 1000) {
      toast.error("Reply message is too long (max 1000 characters)");
      return;
    }

    setSendingReply(notificationId);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create reply notification
      const { error } = await supabase
        .from("notifications")
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          title: "Re: Message",
          message: replyText,
          priority: "normal",
          parent_notification_id: notificationId,
        });

      if (error) throw error;

      // Clear the input
      setQuickReplyText(prev => {
        const updated = { ...prev };
        delete updated[notificationId];
        return updated;
      });

      toast.success("Reply sent successfully");
      fetchNotifications(0, false);
    } catch (error: any) {
      console.error("Error sending quick reply:", error);
      toast.error("Failed to send reply");
    } finally {
      setSendingReply(null);
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = (notifications: Notification[]) => {
    const groups = {
      today: [] as Notification[],
      yesterday: [] as Notification[],
      thisWeek: [] as Notification[],
      older: [] as Notification[]
    };

    notifications.forEach(notification => {
      const date = new Date(notification.created_at);
      
      if (isToday(date)) {
        groups.today.push(notification);
      } else if (isYesterday(date)) {
        groups.yesterday.push(notification);
      } else if (isThisWeek(date, { weekStartsOn: 1 })) {
        groups.thisWeek.push(notification);
      } else {
        groups.older.push(notification);
      }
    });

    return groups;
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Calculate payment statistics
  const paymentStats = {
    pendingCount: notifications.filter(n => n.payment_data && !n.payment_data.applied).length,
    pendingTotal: notifications
      .filter(n => n.payment_data && !n.payment_data.applied)
      .reduce((sum, n) => sum + (n.payment_data?.amount || 0), 0),
    appliedCount: notifications.filter(n => n.payment_data && n.payment_data.applied).length,
    appliedTotal: notifications
      .filter(n => n.payment_data && n.payment_data.applied)
      .reduce((sum, n) => sum + (n.payment_data?.amount || 0), 0),
  };
  
  // Infinite scroll observer
  useEffect(() => {
    if (!open) return;
    
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [hasMore, loading, loadMore, open]);
  
  // Refetch when notifications are invalidated by realtime subscription
  useEffect(() => {
    let isSubscribed = true;
    
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === 'notifications' && isSubscribed && open) {
        fetchNotifications(0, false);
      }
    });
    
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [queryClient, open]);

  const [userRole, setUserRole] = useState<string>("");

  // Fetch user role on mount
  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    if (profile) {
      setUserRole(profile.role);
    }
  };

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    fetchUserRole();
  }, []);

  // Fetch tenant status for a given tenant ID
  const fetchTenantStatus = async (tenantId: string) => {
    if (tenantStatuses[tenantId]) return; // Already fetched
    
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("status, outstanding_balance")
        .eq("id", tenantId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setTenantStatuses(prev => ({
          ...prev,
          [tenantId]: {
            status: data.status || "pending",
            outstanding_balance: data.outstanding_balance || 0
          }
        }));
      }
    } catch (error) {
      console.error("Error fetching tenant status:", error);
    }
  };

  // Extract tenant IDs from notifications and fetch their statuses
  useEffect(() => {
    let isMounted = true;
    
    const fetchStatuses = async () => {
      if (notifications.length === 0 || !isMounted) return;
      
      const tenantIds = new Set<string>();
      
      notifications.forEach(notification => {
        if (notification.payment_data?.tenant_id) {
          tenantIds.add(notification.payment_data.tenant_id);
        }
        
        const matches = notification.message.matchAll(/\[TENANT:([^:]+):[^\]]+\]/g);
        for (const match of matches) {
          tenantIds.add(match[1]);
        }
      });
      
      // Batch fetch all tenant statuses at once
      if (tenantIds.size > 0 && isMounted) {
        try {
          const { data, error } = await supabase
            .from("tenants")
            .select("id, status, outstanding_balance")
            .in("id", Array.from(tenantIds));
          
          if (error) throw error;
          
          if (data && isMounted) {
            const statusMap: Record<string, { status: string; outstanding_balance: number }> = {};
            data.forEach(tenant => {
              statusMap[tenant.id] = {
                status: tenant.status || "pending",
                outstanding_balance: tenant.outstanding_balance || 0
              };
            });
            setTenantStatuses(prev => ({ ...prev, ...statusMap }));
          }
        } catch (error) {
          console.error("Error fetching tenant statuses:", error);
        }
      }
    };
    
    fetchStatuses();
    
    return () => {
      isMounted = false;
    };
  }, [notifications.length]);

  // Helper function to render status badge
  const getStatusBadge = (tenantId: string) => {
    const tenantStatus = tenantStatuses[tenantId];
    if (!tenantStatus) return null;
    
    const { status, outstanding_balance } = tenantStatus;
    
    // Determine if overdue (outstanding balance > 0 and status is verified)
    const isOverdue = outstanding_balance > 0 && status === "verified";
    const displayStatus = isOverdue ? "overdue" : status;
    
    const statusConfig = {
      verified: { label: "Active", className: "bg-green-100 text-green-700 border-green-300" },
      overdue: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-300" },
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
      rejected: { label: "Rejected", className: "bg-gray-100 text-gray-700 border-gray-300" }
    };
    
    const config = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge className={`${config.className} text-[10px] px-1.5 py-0 h-4 font-semibold`}>
        {config.label}
      </Badge>
    );
  };

  const parseMessageWithTenantTags = (message: string): string => {
    // Extract tenant names from tags for display
    return message.replace(/\[TENANT:[^\]]+:([^\]]+)\]/g, '$1');
  };

  const renderMessageWithClickableTags = (message: string) => {
    // Parse [TENANT:id:name] tags and make them clickable
    const parts = message.split(/(\[TENANT:[^\]]+\])/g);
    
    return parts.map((part, index) => {
      const match = part.match(/\[TENANT:([^:]+):([^\]]+)\]/);
      if (match) {
        const [, tenantId, tenantName] = match;
        // Route based on user role - agents go to agent routes, managers to manager routes
        const tenantRoute = userRole === "agent" 
          ? `/agent/tenants/${tenantId}` 
          : `/manager/tenants/${tenantId}`;
        
        return (
          <TooltipProvider key={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/15 text-primary cursor-pointer hover:bg-primary/25 hover:scale-105 transition-all font-semibold underline decoration-2 underline-offset-2 decoration-primary/60 hover:decoration-primary shadow-sm hover:shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      haptics.light();
                      navigate(tenantRoute);
                      setOpen(false);
                    }}
                  >
                    <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
                    {tenantName}
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </span>
                  {getStatusBadge(tenantId)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tap to view tenant details</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;

      fetchNotifications();
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("recipient_id", user.id)
        .eq("read", false);

      if (error) throw error;

      toast.success("All notifications marked as read");
      fetchNotifications();
    } catch (error: any) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleApplyPayment = async (notification: Notification) => {
    if (!notification.payment_data || notification.payment_data.applied) {
      return;
    }

    setApplyingPayment(notification.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get agent data with profile
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select(`
          id,
          profiles:user_id (
            full_name,
            phone_number
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (agentError) throw agentError;

      const paymentData = notification.payment_data;
      
      // Calculate commission (5%)
      const commission = paymentData.amount * 0.05;

      // Apply payment using optimistic mutation
      await optimisticPayment.mutateAsync({
        tenantId: paymentData.tenant_id,
        agentId: agentData.id,
        amount: paymentData.amount,
        commission: commission,
        paymentMethod: paymentData.payment_method,
        collectionDate: paymentData.payment_date,
      });

      // Fetch updated tenant data for receipt
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("tenant_name, tenant_phone, rent_amount, outstanding_balance")
        .eq("id", paymentData.tenant_id)
        .single();

      if (tenantError) throw tenantError;

      // Mark payment as applied in notification
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ 
          payment_data: {
            ...paymentData,
            applied: true
          }
        })
        .eq("id", notification.id);

      if (updateError) throw updateError;

      // Generate receipt number (timestamp-based)
      const receiptNumber = `MGR-${Date.now().toString().slice(-8)}`;

      // Prepare receipt data
      setReceiptData({
        paymentData: {
          amount: paymentData.amount,
          commission: commission,
          collectionDate: paymentData.payment_date,
          paymentMethod: paymentData.payment_method,
        },
        tenantData: {
          tenant_name: tenantData.tenant_name,
          tenant_phone: tenantData.tenant_phone,
          rent_amount: tenantData.rent_amount || 0,
          outstanding_balance: tenantData.outstanding_balance || 0,
        },
        agentData: {
          agent_name: (agentData as any).profiles?.full_name || "Agent",
          agent_phone: (agentData as any).profiles?.phone_number || "",
        },
        receiptNumber,
      });

      toast.success("Payment applied successfully", {
        description: `UGX ${paymentData.amount.toLocaleString()} recorded for ${paymentData.tenant_name}`
      });

      fetchNotifications();
      
      // Show receipt dialog
      setShowReceipt(true);
    } catch (error: any) {
      console.error("Error applying payment:", error);
      toast.error("Failed to apply payment", {
        description: error.message
      });
    } finally {
      setApplyingPayment(null);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Zap className="h-4 w-4 text-destructive" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "low":
        return <Info className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500 text-white border-red-600 font-semibold";
      case "high":
        return "bg-orange-500 text-white border-orange-600 font-semibold";
      case "low":
        return "bg-gray-400 text-white border-gray-500";
      default:
        return "bg-blue-500 text-white border-blue-600";
    }
  };

  const getPriorityLabel = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const renderNotificationCard = (notification: Notification) => (
    <Card 
      key={notification.id}
      className={`${!notification.read ? 'border-primary/50 bg-primary/5' : ''} cursor-pointer hover:shadow-md transition-shadow`}
      onClick={() => {
        if (!notification.read) {
          markAsRead(notification.id);
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getPriorityIcon(notification.priority)}
            <CardTitle className="text-base truncate">{notification.title}</CardTitle>
          </div>
          <Badge className={`${getPriorityColor(notification.priority)} shrink-0 px-2 py-1`}>
            {getPriorityLabel(notification.priority)}
          </Badge>
        </div>
        <CardDescription className="text-xs space-y-1">
          <div>From: {notification.profiles?.full_name || "System"} • {format(new Date(notification.created_at), "MMM d, h:mm a")}</div>
          {notification.read && notification.read_at && (
            <div className="flex items-center gap-1 text-green-600 font-medium">
              <Check className="h-3 w-3" />
              Read {formatDistanceToNow(new Date(notification.read_at), { addSuffix: true })} 
              <span className="text-muted-foreground font-normal">
                ({format(new Date(notification.read_at), "MMM d, h:mm a")})
              </span>
            </div>
          )}
          {!notification.read && (
            <div className="flex items-center gap-1 text-orange-500 font-medium">
              <AlertCircle className="h-3 w-3" />
              Unread
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-sm whitespace-pre-wrap">
          {renderMessageWithClickableTags(notification.message)}
        </p>
        
        {/* Quick Reply Section - Only for messages from managers */}
        {!notification.payment_data && notification.sender_id !== notification.recipient_id && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your reply..."
                value={quickReplyText[notification.id] || ""}
                onChange={(e) => setQuickReplyText(prev => ({
                  ...prev,
                  [notification.id]: e.target.value
                }))}
                className="min-h-[60px] resize-none"
                maxLength={1000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleQuickReply(notification.id, notification.sender_id);
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {quickReplyText[notification.id]?.length || 0}/1000 • Press Ctrl+Enter to send
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNotificationId(notification.id);
                    setThreadDialogOpen(true);
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  View Thread
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickReply(notification.id, notification.sender_id);
                  }}
                  disabled={sendingReply === notification.id || !quickReplyText[notification.id]?.trim()}
                >
                  {sendingReply === notification.id ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Original Reply Button - For payment notifications or when quick reply is not shown */}
        {notification.payment_data && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNotificationId(notification.id);
                setThreadDialogOpen(true);
                if (!notification.read) {
                  markAsRead(notification.id);
                }
              }}
              className="w-full"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Reply to Message
            </Button>
          </div>
        )}
        
        {/* Payment data display - PRIORITY */}
        {notification.payment_data && (
          <div className="mt-3 p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200 dark:border-green-800 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500 text-white border-green-600 font-semibold">
                  PRIORITY PAYMENT
                </Badge>
                {notification.payment_data.applied && (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Applied
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Tenant:</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            haptics.light();
                            navigate(`/agent/tenants/${notification.payment_data!.tenant_id}`);
                            setOpen(false);
                          }}
                          className="block text-left font-semibold text-primary hover:text-primary/80 underline decoration-2 underline-offset-2 transition-colors cursor-pointer"
                        >
                          {notification.payment_data.tenant_name}
                        </button>
                        {getStatusBadge(notification.payment_data.tenant_id)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tap to view tenant details</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Amount:</span>
                <p className="font-bold text-green-700 dark:text-green-400">UGX {notification.payment_data.amount.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Method:</span>
                <p className="font-medium capitalize">{notification.payment_data.payment_method}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Date:</span>
                <p className="font-medium">{format(new Date(notification.payment_data.payment_date), "MMM d, yyyy")}</p>
              </div>
            </div>
            
            {!notification.payment_data.applied && (
              <Button
                size="sm"
                className="w-full mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyPayment(notification);
                }}
                disabled={applyingPayment === notification.id}
              >
                {applyingPayment === notification.id ? (
                  <>Applying...</>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Apply Payment to Tenant Account
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-notification-trigger>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-full sm:max-w-full p-0 flex flex-col h-full">
        <SheetHeader className="p-6 pb-0 border-b">
          <SheetTitle className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
          </SheetTitle>
          <SheetDescription>
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'No new notifications'}
          </SheetDescription>
          
          {/* Search and Filters */}
          <div className="space-y-3 pt-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Date Range Filters */}
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              {(searchQuery || dateFrom || dateTo || filterType !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </div>
          
          {/* Filter Tabs */}
          <Tabs value={filterType} onValueChange={(value) => setFilterType(value as typeof filterType)} className="w-full pt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="payment" className="text-xs sm:text-sm">
                Payments ({notifications.filter(n => n.payment_data !== null).length})
              </TabsTrigger>
              <TabsTrigger value="message" className="text-xs sm:text-sm">
                Messages ({notifications.filter(n => n.payment_data === null && n.parent_notification_id === null).length})
              </TabsTrigger>
              <TabsTrigger value="system" className="text-xs sm:text-sm">
                System ({notifications.filter(n => n.sender_id === n.recipient_id).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        {/* Payment Stats Summary - Show only if there are payment notifications */}
        {(paymentStats.pendingCount > 0 || paymentStats.appliedCount > 0) && (
          <div className="p-6 pb-4 border-b bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <div className="grid grid-cols-2 gap-3">
              {/* Pending Payments Card */}
              <Card className="border-2 border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-900">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardDescription className="text-xs font-medium text-orange-600 dark:text-orange-400">
                    PENDING PAYMENTS
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {paymentStats.pendingCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      UGX {paymentStats.pendingTotal.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Applied Payments Card */}
              <Card className="border-2 border-green-200 dark:border-green-800 bg-white dark:bg-gray-900">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardDescription className="text-xs font-medium text-green-600 dark:text-green-400">
                    APPLIED PAYMENTS
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {paymentStats.appliedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      UGX {paymentStats.appliedTotal.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Total Summary */}
            <div className="mt-3 p-2 rounded-lg bg-white/60 dark:bg-gray-900/60 border border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-muted-foreground">Total Payment Value:</span>
                <span className="font-bold text-primary">
                  UGX {(paymentStats.pendingTotal + paymentStats.appliedTotal).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {filterType === "all" ? "No notifications yet" : `No ${filterType} notifications`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 pb-4">
              {(() => {
                const groupedNotifications = groupNotificationsByDate(filteredNotifications);
                
                return (
                  <>
                    {/* Today Section */}
                    {groupedNotifications.today.length > 0 && (
                      <Collapsible
                        open={!collapsedSections.today}
                        onOpenChange={() => toggleSection('today')}
                      >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2">
                            {collapsedSections.today ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold text-sm">Today</span>
                            <Badge variant="secondary" className="text-xs">
                              {groupedNotifications.today.length}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 mt-3">
                          {groupedNotifications.today.map(renderNotificationCard)}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Yesterday Section */}
                    {groupedNotifications.yesterday.length > 0 && (
                      <Collapsible
                        open={!collapsedSections.yesterday}
                        onOpenChange={() => toggleSection('yesterday')}
                      >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2">
                            {collapsedSections.yesterday ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold text-sm">Yesterday</span>
                            <Badge variant="secondary" className="text-xs">
                              {groupedNotifications.yesterday.length}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 mt-3">
                          {groupedNotifications.yesterday.map(renderNotificationCard)}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* This Week Section */}
                    {groupedNotifications.thisWeek.length > 0 && (
                      <Collapsible
                        open={!collapsedSections.thisWeek}
                        onOpenChange={() => toggleSection('thisWeek')}
                      >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2">
                            {collapsedSections.thisWeek ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold text-sm">This Week</span>
                            <Badge variant="secondary" className="text-xs">
                              {groupedNotifications.thisWeek.length}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 mt-3">
                          {groupedNotifications.thisWeek.map(renderNotificationCard)}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Older Section */}
                    {groupedNotifications.older.length > 0 && (
                      <Collapsible
                        open={!collapsedSections.older}
                        onOpenChange={() => toggleSection('older')}
                      >
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2">
                            {collapsedSections.older ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="font-semibold text-sm">Older</span>
                            <Badge variant="secondary" className="text-xs">
                              {groupedNotifications.older.length}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 mt-3">
                          {groupedNotifications.older.map(renderNotificationCard)}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </>
                );
              })()}
              
              {/* Infinite scroll trigger */}
              <div ref={observerTarget} className="h-4 flex items-center justify-center">
                {loading && hasMore && (
                  <div className="text-sm text-muted-foreground">Loading more...</div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>

    {/* Message Thread Dialog */}
    {selectedNotificationId && (
      <MessageThreadDialog
        open={threadDialogOpen}
        onOpenChange={setThreadDialogOpen}
        notificationId={selectedNotificationId}
        onReplySent={() => {
          fetchNotifications();
          toast.success("Reply sent successfully");
        }}
      />
    )}

    {/* Payment Receipt Dialog */}
    <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
        </DialogHeader>
        {receiptData && (
          <PaymentReceipt
            paymentData={receiptData.paymentData}
            tenantData={receiptData.tenantData}
            agentData={receiptData.agentData}
            receiptNumber={receiptData.receiptNumber}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};

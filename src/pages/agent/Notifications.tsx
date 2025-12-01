import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, X, AlertCircle, Info, AlertTriangle, Zap, Check, MessageSquare, ArrowLeft, Search, XCircle, Send, ChevronDown, ChevronRight, Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VirtualizedList } from "@/components/VirtualizedList";
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { useOptimisticPayment } from "@/hooks/useOptimisticPayment";
import { useQueryClient } from "@tanstack/react-query";
import PaymentReceipt from "@/components/PaymentReceipt";
import { useRealtimeNotifications } from "@/hooks/useRealtimeSubscription";
import MessageThreadDialog from "@/components/MessageThreadDialog";
import { useNotificationAlerts } from "@/hooks/useNotificationAlerts";
import { haptics } from "@/utils/haptics";
import AgentLayout from "@/components/AgentLayout";
import PullToRefresh from "react-simple-pull-to-refresh";
import { SkeletonWrapper } from "@/components/SkeletonWrapper";
import { Skeleton } from "@/components/ui/skeleton";

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
    collection_id?: string;
    tenant_id: string;
    tenant_name: string;
    tenant_phone?: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    payment_id?: string;
    previous_balance?: number;
    new_balance?: number;
    commission?: number;
    recorded_by?: string;
    manager_name?: string;
    applied?: boolean;
  };
  profiles?: {
    full_name: string | null;
  };
}

const Notifications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
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
      paymentId?: string;
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
  
  const optimisticPaymentMutation = useOptimisticPayment();
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
    setPage(0);
    setNotifications([]);
    setHasMore(true);
    fetchNotifications(0, false);
  }, []);

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
  }, [hasMore, loading, loadMore]);
  
  // Refetch when notifications are invalidated by realtime subscription
  useEffect(() => {
    let isSubscribed = true;
    
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === 'notifications' && isSubscribed) {
        fetchNotifications(0, false);
      }
    });
    
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [queryClient]);

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
    
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
    let label = status;
    
    if (status === "verified") {
      variant = "default";
      label = "Active";
    } else if (status === "pending") {
      variant = "secondary";
      label = "Pending";
    } else if (status === "rejected") {
      variant = "destructive";
      label = "Rejected";
    }
    
    return (
      <div className="flex items-center gap-2 mt-1">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-xs text-muted-foreground">
          Balance: UGX {outstanding_balance.toLocaleString()}
        </span>
      </div>
    );
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);
      
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Apply payment from notification
  const handleApplyPayment = async (notification: Notification) => {
    if (!notification.payment_data) return;
    
    setApplyingPayment(notification.id);
    haptics.light();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch agent data
      const { data: agentData } = await supabase
        .from("agents")
        .select("user_id, profiles!agents_user_id_fkey(full_name, phone_number)")
        .eq("user_id", user.id)
        .single();

      if (!agentData) throw new Error("Agent not found");

      // Fetch tenant data
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", notification.payment_data.tenant_id)
        .single();

      if (!tenantData) throw new Error("Tenant not found");

      // Record the payment using optimistic update
      await optimisticPaymentMutation.mutateAsync({
        tenantId: notification.payment_data.tenant_id,
        amount: notification.payment_data.amount,
        paymentMethod: notification.payment_data.payment_method,
        collectionDate: notification.payment_data.payment_date,
        agentId: agentData.user_id,
        commission: notification.payment_data.amount * 0.05,
      });

      if (true) {
        // Mark payment as applied
        await supabase
          .from("notifications")
          .update({ 
            payment_data: {
              ...notification.payment_data,
              applied: true
            }
          })
          .eq("id", notification.id);

        // Update local state
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? {
                  ...n,
                  payment_data: n.payment_data
                    ? { ...n.payment_data, applied: true }
                    : undefined
                }
              : n
          )
        );

        // Prepare receipt data
        setReceiptData({
          paymentData: {
            amount: notification.payment_data.amount,
            commission: notification.payment_data.amount * 0.05,
            collectionDate: notification.payment_data.payment_date,
            paymentMethod: notification.payment_data.payment_method,
            paymentId: notification.payment_data.payment_id,
          },
          tenantData: {
            tenant_name: tenantData.tenant_name,
            tenant_phone: tenantData.tenant_phone,
            rent_amount: tenantData.rent_amount || 0,
            outstanding_balance: tenantData.outstanding_balance || 0,
          },
          agentData: {
            agent_name: (agentData.profiles as any)?.full_name || "Agent",
            agent_phone: (agentData.profiles as any)?.phone_number || "",
          },
          receiptNumber: `REC-${Date.now()}`,
        });

        setShowReceipt(true);
        toast.success("Payment applied successfully!");
        haptics.success();
      }
    } catch (error: any) {
      console.error("Error applying payment:", error);
      toast.error("Failed to apply payment");
      haptics.error();
    } finally {
      setApplyingPayment(null);
    }
  };

  // Render message with clickable tenant tags
  const renderMessageWithTenantTags = (message: string) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    
    const regex = /\[TENANT:([^:]+):([^\]]+)\]/g;
    let match;
    
    while ((match = regex.exec(message)) !== null) {
      const [fullMatch, tenantId, tenantName] = match;
      
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(message.substring(lastIndex, match.index));
      }
      
      // Add clickable tenant tag
      parts.push(
        <Button
          key={`tenant-${tenantId}-${match.index}`}
          variant="link"
          className="h-auto p-0 text-primary font-semibold underline hover:text-primary/80"
          onClick={() => {
            haptics.light();
            navigate(`/agent/tenants/${tenantId}`);
          }}
        >
          {tenantName}
        </Button>
      );
      
      lastIndex = match.index + fullMatch.length;
    }
    
    // Add remaining text
    if (lastIndex < message.length) {
      parts.push(message.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : message;
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertTriangle className="h-4 w-4" />;
      case "high":
        return <AlertCircle className="h-4 w-4" />;
      case "normal":
        return <Info className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-500 border-red-500";
      case "high":
        return "text-orange-500 border-orange-500";
      case "normal":
        return "text-blue-500 border-blue-500";
      default:
        return "text-gray-500 border-gray-500";
    }
  };

  // Render notification card
  const renderNotificationCard = (notification: Notification) => {
    const isPayment = !!notification.payment_data;
    const isRead = notification.read;
    
    return (
      <Card
        key={notification.id}
        className={`mb-4 transition-all hover:shadow-md ${
          !isRead ? "border-l-4 border-l-primary bg-primary/5" : ""
        } ${isPayment ? "border-2 border-primary shadow-lg" : ""}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full ${getPriorityColor(notification.priority)}`}>
                  {isPayment ? <DollarSign className="h-5 w-5" /> : getPriorityIcon(notification.priority)}
                </div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  {notification.title}
                  {isPayment && (
                    <Badge variant="default" className="text-xs">
                      Payment
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                From: {notification.profiles?.full_name || "System"} •{" "}
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </CardDescription>
            </div>
            {!isRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAsRead(notification.id)}
                className="shrink-0"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Payment Data */}
          {isPayment && notification.payment_data && (
            <div className="p-4 bg-primary/10 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">UGX {notification.payment_data.amount.toLocaleString()}</span>
                <Badge variant={notification.payment_data.applied ? "default" : "secondary"}>
                  {notification.payment_data.recorded_by === "manager" 
                    ? "Manager Payment"
                    : notification.payment_data.applied ? "Applied" : "Pending"}
                </Badge>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tenant:</span>
                  <Button
                    variant="link"
                    className="h-auto p-0 font-semibold"
                    onClick={() => navigate(`/agent/tenants/${notification.payment_data!.tenant_id}`)}
                  >
                    {notification.payment_data.tenant_name}
                  </Button>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-medium">{notification.payment_data.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{format(new Date(notification.payment_data.payment_date), "MMM d, yyyy")}</span>
                </div>
                {notification.payment_data.recorded_by === "manager" && notification.payment_data.manager_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recorded By:</span>
                    <span className="font-medium">{notification.payment_data.manager_name}</span>
                  </div>
                )}
                {notification.payment_data.previous_balance !== undefined && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Previous Balance:</span>
                      <span className="font-medium">UGX {notification.payment_data.previous_balance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">New Balance:</span>
                      <span className="font-semibold text-success">UGX {notification.payment_data.new_balance?.toLocaleString() || 0}</span>
                    </div>
                  </>
                )}
              </div>
              {getStatusBadge(notification.payment_data.tenant_id)}
              
              {/* Show different buttons based on payment type */}
              {notification.payment_data.recorded_by === "manager" ? (
                <Button
                  className="w-full mt-3 bg-success hover:bg-success/90"
                  onClick={async () => {
                    haptics.light();
                    try {
                      // Fetch agent data
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error("Not authenticated");

                      const { data: agentData } = await supabase
                        .from("agents")
                        .select("user_id, profiles!agents_user_id_fkey(full_name, phone_number)")
                        .eq("user_id", user.id)
                        .single();

                      if (!agentData) throw new Error("Agent not found");

                      // Set receipt data and show receipt
                      setReceiptData({
                        paymentData: {
                          amount: notification.payment_data!.amount,
                          commission: notification.payment_data!.commission || notification.payment_data!.amount * 0.05,
                          collectionDate: notification.payment_data!.payment_date,
                          paymentMethod: notification.payment_data!.payment_method,
                          paymentId: notification.payment_data!.payment_id,
                        },
                        tenantData: {
                          tenant_name: notification.payment_data!.tenant_name,
                          tenant_phone: notification.payment_data!.tenant_phone || "",
                          rent_amount: 0,
                          outstanding_balance: notification.payment_data!.new_balance || 0,
                        },
                        agentData: {
                          agent_name: (agentData.profiles as any)?.full_name || "Agent",
                          agent_phone: (agentData.profiles as any)?.phone_number || "",
                        },
                        receiptNumber: `REC-${notification.payment_data!.collection_id || Date.now()}`,
                      });

                      setShowReceipt(true);
                      toast.success("Receipt generated!");
                      haptics.success();
                    } catch (error) {
                      console.error("Error generating receipt:", error);
                      toast.error("Failed to generate receipt");
                      haptics.error();
                    }
                  }}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Generate Receipt
                </Button>
              ) : !notification.payment_data.applied && (
                <Button
                  className="w-full mt-3"
                  onClick={() => handleApplyPayment(notification)}
                  disabled={applyingPayment === notification.id}
                >
                  {applyingPayment === notification.id ? (
                    <>
                      <Zap className="h-4 w-4 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Apply Payment
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Message Content */}
          <div className="text-sm whitespace-pre-wrap">
            {renderMessageWithTenantTags(notification.message)}
          </div>

          {/* Quick Reply Section */}
          {!notification.parent_notification_id && notification.sender_id !== notification.recipient_id && (
            <div className="pt-3 border-t space-y-2">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your reply..."
                  value={quickReplyText[notification.id] || ""}
                  onChange={(e) =>
                    setQuickReplyText(prev => ({ ...prev, [notification.id]: e.target.value }))
                  }
                  className="min-h-[60px] text-base"
                  maxLength={1000}
                />
                <Button
                  size="sm"
                  onClick={() => handleQuickReply(notification.id, notification.sender_id)}
                  disabled={sendingReply === notification.id || !quickReplyText[notification.id]?.trim()}
                  className="shrink-0"
                >
                  {sendingReply === notification.id ? (
                    <Zap className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedNotificationId(notification.id);
                  setThreadDialogOpen(true);
                }}
                className="w-full"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                View Thread
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const groupedNotifications = groupNotificationsByDate(filteredNotifications);

  const renderGroupSection = (title: string, notifications: Notification[], sectionKey: string) => {
    if (notifications.length === 0) return null;

    const isCollapsed = collapsedSections[sectionKey];

    return (
      <div key={sectionKey} className="mb-6">
        <Collapsible open={!isCollapsed} onOpenChange={() => toggleSection(sectionKey)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{title}</h3>
              <Badge variant="secondary">{notifications.length}</Badge>
            </div>
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            {notifications.length > 10 ? (
              <VirtualizedList
                items={notifications}
                renderItem={(notification) => renderNotificationCard(notification)}
                itemHeight={180}
                height="500px"
              />
            ) : (
              notifications.map(notification => renderNotificationCard(notification))
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  const handleRefresh = async () => {
    haptics.light();
    setPage(0);
    setNotifications([]);
    setHasMore(true);
    await fetchNotifications(0, false);
  };

  // Type counts for tabs
  const typeCounts = {
    all: notifications.length,
    payment: notifications.filter(n => n.payment_data).length,
    message: notifications.filter(n => !n.payment_data && !n.parent_notification_id).length,
    system: notifications.filter(n => n.sender_id === n.recipient_id).length,
  };

  return (
    <AgentLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-screen pb-20">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="flex items-center gap-3 p-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/agent/dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">All Notifications</h1>
                <p className="text-sm text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                </p>
              </div>
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Payment Stats */}
            {paymentStats.pendingCount > 0 && (
              <div className="px-4 pb-3">
                <Card className="border-2 border-primary">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pending Payments</p>
                        <p className="text-2xl font-bold">UGX {paymentStats.pendingTotal.toLocaleString()}</p>
                      </div>
                      <Badge variant="default" className="text-lg px-3 py-1">
                        {paymentStats.pendingCount}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="px-4 pb-3">
              <Tabs value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">
                    All
                    {typeCounts.all > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {typeCounts.all}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="payment" className="text-xs">
                    Payment
                    {typeCounts.payment > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {typeCounts.payment}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="message" className="text-xs">
                    Message
                    {typeCounts.message > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {typeCounts.message}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="system" className="text-xs">
                    System
                    {typeCounts.system > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {typeCounts.system}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Search and Filters */}
            <div className="px-4 pb-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-base"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setSearchQuery("")}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateFrom ? format(dateFrom, "MMM d") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateTo ? format(dateTo, "MMM d") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                  </PopoverContent>
                </Popover>

                {(searchQuery || dateFrom || dateTo || filterType !== "all") && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <SkeletonWrapper 
            loading={loading}
            skeleton={
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="mb-4">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            }
          >
            <div className="p-4">
              {filteredNotifications.length === 0 ? (
                <Card className="p-8 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg mb-2">No notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || dateFrom || dateTo || filterType !== "all"
                      ? "No notifications match your filters"
                      : "You're all caught up!"}
                  </p>
                </Card>
              ) : (
                <>
                  {renderGroupSection("Today", groupedNotifications.today, "today")}
                  {renderGroupSection("Yesterday", groupedNotifications.yesterday, "yesterday")}
                  {renderGroupSection("This Week", groupedNotifications.thisWeek, "thisWeek")}
                  {renderGroupSection("Older", groupedNotifications.older, "older")}
                </>
              )}

              {/* Infinite Scroll Trigger */}
              {hasMore && <div ref={observerTarget} className="h-10" />}
            </div>
          </SkeletonWrapper>

          {/* Loading More Indicator */}
          {loading && page > 0 && (
            <div className="flex justify-center p-4">
              <Skeleton className="h-32 w-full" />
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* Dialogs */}
      <MessageThreadDialog
        open={threadDialogOpen}
        onOpenChange={setThreadDialogOpen}
        notificationId={selectedNotificationId || ""}
      />

      {showReceipt && receiptData && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
          <div className="container max-w-2xl mx-auto p-4">
            <div className="flex justify-end mb-4">
              <Button variant="ghost" onClick={() => setShowReceipt(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <PaymentReceipt {...receiptData} />
          </div>
        </div>
      )}
    </AgentLayout>
  );
};

export default Notifications;

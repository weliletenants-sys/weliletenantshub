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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, formatDistanceToNow } from "date-fns";
import { useOptimisticPayment } from "@/hooks/useOptimisticPayment";
import { useQueryClient } from "@tanstack/react-query";
import PaymentReceipt from "./PaymentReceipt";
import { useRealtimeNotifications } from "@/hooks/useRealtimeSubscription";
import MessageThreadDialog from "./MessageThreadDialog";

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
  
  // Enable realtime subscription for notifications
  useRealtimeNotifications();

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

  // Filter notifications based on selected type, search query, and date range
  const filteredNotifications = notifications.filter(notification => {
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
      
      if (!matchesTitle && !matchesMessage && !matchesSender) {
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
  });

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setFilterType("all");
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
    };
  }, [hasMore, loading, loadMore]);
  
  // Refetch when notifications are invalidated by realtime subscription
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === 'notifications') {
        fetchNotifications();
      }
    });
    
    return unsubscribe;
  }, [queryClient]);

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
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/manager/tenants/${tenantId}`);
              setOpen(false);
            }}
          >
            <AlertCircle className="h-3 w-3" />
            {tenantName}
          </span>
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
            <div className="space-y-3 pb-4">
              {filteredNotifications.map((notification) => (
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
                    
                    {/* Reply Button */}
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
                    
                    {/* Payment data display */}
                    {notification.payment_data && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Payment Details</span>
                          {notification.payment_data.applied && (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <Check className="h-3 w-3 mr-1" />
                              Applied
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Tenant:</span>
                            <p className="font-medium">{notification.payment_data.tenant_name}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Amount:</span>
                            <p className="font-medium">UGX {notification.payment_data.amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Method:</span>
                            <p className="font-medium capitalize">{notification.payment_data.payment_method}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Date:</span>
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
              ))}
              
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, X, AlertCircle, Info, AlertTriangle, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, formatDistanceToNow } from "date-fns";
import { useOptimisticPayment } from "@/hooks/useOptimisticPayment";
import { useQueryClient } from "@tanstack/react-query";
import PaymentReceipt from "./PaymentReceipt";

interface Notification {
  id: string;
  sender_id: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  read: boolean;
  read_at: string | null;
  created_at: string;
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
  const [showReceipt, setShowReceipt] = useState(false);
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

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        .limit(50);

      if (error) throw error;

      setNotifications((data || []) as unknown as Notification[]);
      setUnreadCount((data || []).filter(n => !n.read).length);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Set up realtime subscription
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          console.log("Notification change:", payload);
          fetchNotifications();
          
          // Show toast for new notifications
          if (payload.eventType === "INSERT") {
            const newNotification = payload.new as Notification;
            // Parse tenant tags and show clickable notification
            const parsedMessage = parseMessageWithTenantTags(newNotification.message);
            
            toast.info(newNotification.title, {
              description: parsedMessage.length > 100 
                ? parsedMessage.slice(0, 100) + "..." 
                : parsedMessage
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "high":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "low":
        return "bg-muted text-muted-foreground border-muted";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
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
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
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
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
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
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No notifications yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
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
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(notification.priority)}
                        <CardTitle className="text-base">{notification.title}</CardTitle>
                      </div>
                      <Badge className={getPriorityColor(notification.priority)}>
                        {notification.priority}
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
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>

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

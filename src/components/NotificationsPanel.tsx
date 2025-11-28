import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, X, AlertCircle, Info, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { format } from "date-fns";

interface Notification {
  id: string;
  sender_id: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  read: boolean;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

export const NotificationsPanel = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

      setNotifications((data || []) as Notification[]);
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
            toast.info(newNotification.title, {
              description: newNotification.message.slice(0, 100) + (newNotification.message.length > 100 ? "..." : "")
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
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

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error: any) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Zap className="h-4 w-4 text-destructive" />;
      case "high":
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case "low":
        return <Info className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-primary" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "border-destructive bg-destructive/5";
      case "high":
        return "border-orange-600 bg-orange-50";
      case "low":
        return "border-muted";
      default:
        return "border-primary/20 bg-primary/5";
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
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
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </SheetTitle>
          <SheetDescription>
            {unreadCount > 0 ? (
              <span>You have {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}</span>
            ) : (
              <span>You're all caught up!</span>
            )}
          </SheetDescription>
        </SheetHeader>

        {unreadCount > 0 && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="w-full"
            >
              Mark all as read
            </Button>
          </div>
        )}

        <ScrollArea className="h-[calc(100vh-180px)] mt-4">
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : notifications.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No notifications yet</p>
                </CardContent>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`${!notification.read ? "border-primary shadow-sm" : "border-muted"} ${getPriorityColor(notification.priority)} transition-all`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        {getPriorityIcon(notification.priority)}
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {notification.title}
                            {!notification.read && (
                              <Badge variant="default" className="text-xs">New</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            From: {notification.profiles?.full_name || "System"} • 
                            {" "}{format(new Date(notification.created_at), "MMM d, h:mm a")}
                          </CardDescription>
                        </div>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{notification.message}</p>
                    {!notification.read && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2 p-0 h-auto"
                        onClick={() => markAsRead(notification.id)}
                      >
                        Mark as read
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

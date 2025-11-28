import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Search, Mail, MailOpen, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MessageReport {
  id: string;
  title: string;
  message: string;
  priority: string;
  created_at: string;
  sender: {
    full_name: string | null;
  };
  recipients: Array<{
    recipient_id: string;
    recipient_name: string | null;
    recipient_phone: string;
    read: boolean;
    read_at: string | null;
  }>;
  total_recipients: number;
  read_count: number;
  unread_count: number;
  read_rate: number;
}

const DeliveryReports = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MessageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalDelivered: 0,
    totalRead: 0,
    avgReadRate: 0,
  });

  const COLORS = ["#10b981", "#f59e0b", "#6366f1", "#ef4444"];

  useEffect(() => {
    fetchDeliveryReports();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('delivery-reports')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          fetchDeliveryReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDeliveryReports = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch all messages sent by this manager
      const { data: notifications, error } = await supabase
        .from("notifications")
        .select(`
          id,
          title,
          message,
          priority,
          created_at,
          read,
          read_at,
          sender:sender_id (
            full_name
          ),
          recipient:recipient_id (
            id,
            full_name,
            phone_number
          )
        `)
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group notifications by message content (title + message combination)
      const messageGroups = new Map<string, any>();
      
      (notifications || []).forEach((notif: any) => {
        const key = `${notif.title}-${notif.message}`;
        
        if (!messageGroups.has(key)) {
          messageGroups.set(key, {
            id: notif.id,
            title: notif.title,
            message: notif.message,
            priority: notif.priority,
            created_at: notif.created_at,
            sender: notif.sender,
            recipients: [],
            total_recipients: 0,
            read_count: 0,
            unread_count: 0,
            read_rate: 0,
          });
        }

        const group = messageGroups.get(key);
        group.recipients.push({
          recipient_id: notif.recipient?.id,
          recipient_name: notif.recipient?.full_name,
          recipient_phone: notif.recipient?.phone_number,
          read: notif.read,
          read_at: notif.read_at,
        });
        
        group.total_recipients++;
        if (notif.read) {
          group.read_count++;
        } else {
          group.unread_count++;
        }
        
        group.read_rate = group.total_recipients > 0 
          ? (group.read_count / group.total_recipients) * 100 
          : 0;
      });

      const messagesArray = Array.from(messageGroups.values());
      setMessages(messagesArray);

      // Calculate stats
      const totalMessages = messagesArray.length;
      const totalDelivered = messagesArray.reduce((sum, m) => sum + m.total_recipients, 0);
      const totalRead = messagesArray.reduce((sum, m) => sum + m.read_count, 0);
      const avgReadRate = totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0;

      setStats({
        totalMessages,
        totalDelivered,
        totalRead,
        avgReadRate,
      });

    } catch (error: any) {
      console.error("Error fetching delivery reports:", error);
      toast.error("Failed to load delivery reports");
    } finally {
      setLoading(false);
    }
  };

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch = 
      msg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.sender?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPriority = priorityFilter === "all" || msg.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  // Prepare chart data
  const readStatusData = [
    { name: "Read", value: stats.totalRead, color: "#10b981" },
    { name: "Unread", value: stats.totalDelivered - stats.totalRead, color: "#f59e0b" },
  ];

  const priorityData = messages.reduce((acc, msg) => {
    const existing = acc.find(item => item.priority === msg.priority);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ priority: msg.priority, count: 1 });
    }
    return acc;
  }, [] as Array<{ priority: string; count: number }>);

  return (
    <ManagerLayout currentPage="/manager/delivery-reports">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Message Delivery Reports</h1>
            <p className="text-muted-foreground mt-2">
              Track message delivery and read status for all sent messages
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="card-interactive">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Messages Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {stats.totalMessages}
              </div>
            </CardContent>
          </Card>

          <Card className="card-interactive">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Recipients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {stats.totalDelivered}
              </div>
            </CardContent>
          </Card>

          <Card className="card-interactive">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Messages Read
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.totalRead}
              </div>
            </CardContent>
          </Card>

          <Card className="card-interactive">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Read Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {stats.avgReadRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Read Status Distribution</CardTitle>
              <CardDescription>Overall message read status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={readStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => 
                      `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {readStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messages by Priority</CardTitle>
              <CardDescription>Distribution of message priorities</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priority" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Message Delivery Details</CardTitle>
            <CardDescription>
              View detailed read status for each message sent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading delivery reports...
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No messages found
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMessages.map((msg) => (
                  <Collapsible key={msg.id} className="border rounded-lg">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h3 className="font-semibold text-lg">{msg.title}</h3>
                            <Badge
                              variant={
                                msg.priority === "urgent" ? "destructive" :
                                msg.priority === "high" ? "default" :
                                msg.priority === "low" ? "secondary" : "outline"
                              }
                            >
                              {msg.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {msg.message}
                          </p>
                          <div className="flex items-center gap-4 flex-wrap text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{msg.total_recipients} recipients</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MailOpen className="h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">
                                {msg.read_count} read ({msg.read_rate.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMessage(msg.id)}
                          >
                            {expandedMessages.has(msg.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="border-t px-4 pb-4">
                        <div className="mt-4">
                          <h4 className="font-medium mb-3">Recipient Status</h4>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Agent</TableHead>
                                  <TableHead>Phone</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Read At</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {msg.recipients.map((recipient, idx) => (
                                  <TableRow key={`${recipient.recipient_id}-${idx}`}>
                                    <TableCell className="font-medium">
                                      {recipient.recipient_name || "Unknown"}
                                    </TableCell>
                                    <TableCell>{recipient.recipient_phone}</TableCell>
                                    <TableCell>
                                      {recipient.read ? (
                                        <Badge variant="default" className="bg-green-600">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Read
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary">
                                          <Clock className="h-3 w-3 mr-1" />
                                          Unread
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {recipient.read_at
                                        ? formatDistanceToNow(new Date(recipient.read_at), { addSuffix: true })
                                        : "-"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default DeliveryReports;

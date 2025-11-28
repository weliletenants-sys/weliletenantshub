import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Send, User, UserCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";

interface MessageThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notificationId: string;
  onReplySent?: () => void;
}

interface ThreadMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
  is_reply: boolean;
  read: boolean;
}

export default function MessageThreadDialog({
  open,
  onOpenChange,
  notificationId,
  onReplySent
}: MessageThreadDialogProps) {
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchThread();
      getCurrentUser();
    }
  }, [open, notificationId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchThread = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_notification_thread', {
        notification_id: notificationId
      });

      if (error) throw error;
      setThread(data || []);
    } catch (error) {
      console.error("Error fetching thread:", error);
      toast.error("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      toast.error("Reply cannot be empty");
      return;
    }

    try {
      setSending(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the original message (first in thread)
      const originalMessage = thread[0];
      if (!originalMessage) return;

      // Determine recipient (opposite of current user)
      const recipientId = originalMessage.sender_id === user.id 
        ? thread.find(m => m.sender_id !== user.id)?.sender_id || originalMessage.sender_id
        : originalMessage.sender_id;

      // Send reply
      const { error } = await supabase
        .from("notifications")
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          title: `Re: ${originalMessage.message.substring(0, 30)}...`,
          message: replyText,
          priority: "normal",
          read: false,
          parent_notification_id: notificationId
        });

      if (error) throw error;

      haptics.success();
      toast.success("Reply sent!");
      setReplyText("");
      await fetchThread();
      onReplySent?.();
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const isFromCurrentUser = (senderId: string) => senderId === currentUserId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            💬 Conversation Thread
            <Badge variant="outline" className="ml-2">
              {thread.length} message{thread.length !== 1 ? 's' : ''}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 pr-4 max-h-[400px]">
              <div className="space-y-4 py-4">
                {thread.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      isFromCurrentUser(message.sender_id) ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div className={`flex-shrink-0 ${isFromCurrentUser(message.sender_id) ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isFromCurrentUser(message.sender_id) ? (
                        <UserCircle className="h-8 w-8" />
                      ) : (
                        <User className="h-8 w-8" />
                      )}
                    </div>
                    <div className={`flex-1 space-y-1 ${isFromCurrentUser(message.sender_id) ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {isFromCurrentUser(message.sender_id) ? 'You' : message.sender_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), "MMM d, h:mm a")}
                        </span>
                        {!message.read && !isFromCurrentUser(message.sender_id) && (
                          <Badge variant="secondary" className="text-xs">New</Badge>
                        )}
                      </div>
                      <div
                        className={`rounded-lg p-3 max-w-[80%] ${
                          isFromCurrentUser(message.sender_id)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t pt-4 space-y-3">
              <Textarea
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[80px]"
                disabled={sending}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={sending}
                >
                  Close
                </Button>
                <Button
                  onClick={handleSendReply}
                  disabled={sending || !replyText.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

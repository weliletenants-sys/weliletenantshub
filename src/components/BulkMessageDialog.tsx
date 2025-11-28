import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send } from "lucide-react";

interface BulkMessageDialogProps {
  selectedAgentIds: string[];
  agentNames: string[];
}

export const BulkMessageDialog = ({ selectedAgentIds, agentNames }: BulkMessageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (selectedAgentIds.length === 0) {
      toast.error("No agents selected");
      return;
    }

    setSending(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get agent user IDs from agent IDs
      const { data: agents, error: agentsError } = await supabase
        .from("agents")
        .select("user_id")
        .in("id", selectedAgentIds);

      if (agentsError) throw agentsError;
      if (!agents || agents.length === 0) throw new Error("No agents found");

      const recipientIds = agents.map(a => a.user_id);

      // Create notification records for each agent
      const notifications = recipientIds.map(recipientId => ({
        sender_id: user.id,
        recipient_id: recipientId,
        title,
        message,
        priority,
      }));

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) throw insertError;

      toast.success(`Message sent to ${selectedAgentIds.length} agent(s)`, {
        description: `"${title}" was delivered successfully`
      });

      // Reset form
      setTitle("");
      setMessage("");
      setPriority("normal");
      setOpen(false);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message", {
        description: error.message
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm"
          disabled={selectedAgentIds.length === 0}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Send Message
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Message to Agents</DialogTitle>
          <DialogDescription>
            Send an in-app message to {selectedAgentIds.length} selected agent(s):
            <div className="mt-2 text-sm font-medium">
              {agentNames.slice(0, 3).join(", ")}
              {agentNames.length > 3 && ` and ${agentNames.length - 3} more`}
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Subject</Label>
            <Input
              id="title"
              placeholder="e.g., Important Update"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/100 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/1000 characters
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
          >
            {sending ? (
              <>Sending...</>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send, FileText, Trash2, Share2, Lock, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CustomTemplateDialog } from "./CustomTemplateDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect } from "react";

interface MessageTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  category: string;
  isCustom?: boolean;
  manager_id?: string;
  is_shared?: boolean;
  creator_name?: string;
}

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "meeting_reminder",
    name: "Team Meeting Reminder",
    category: "Meetings",
    title: "Team Meeting Tomorrow",
    message: "Reminder: We have our monthly team meeting tomorrow at 10:00 AM. Please come prepared to discuss your progress and any challenges you're facing.\n\nLocation: Main Office\nTime: 10:00 AM - 11:30 AM\n\nLooking forward to seeing everyone there!",
    priority: "normal"
  },
  {
    id: "payment_deadline",
    name: "Payment Collection Deadline",
    category: "Payments",
    title: "Collection Deadline This Week",
    message: "Important: This week's payment collection deadline is Friday at 5:00 PM.\n\nPlease ensure all tenant payments are recorded in the system by end of day Friday. Late submissions may delay your commission processing.\n\nIf you need any assistance, please reach out immediately.",
    priority: "high"
  },
  {
    id: "performance_excellent",
    name: "Excellent Performance",
    category: "Performance",
    title: "Outstanding Performance This Month!",
    message: "Congratulations on your excellent performance this month! Your dedication and hard work have not gone unnoticed.\n\nYour collection rate and tenant satisfaction scores are exceptional. Keep up the great work!\n\nThank you for your continued commitment to excellence.",
    priority: "normal"
  },
  {
    id: "performance_improvement",
    name: "Performance Improvement Needed",
    category: "Performance",
    title: "Let's Improve Together",
    message: "I wanted to reach out regarding your recent performance metrics. Your current collection rate is below our target, and I'd like to work with you to improve.\n\nLet's schedule a one-on-one meeting this week to discuss strategies and support I can provide to help you succeed.\n\nPlease reply to confirm your availability.",
    priority: "high"
  },
  {
    id: "motorcycle_milestone",
    name: "Motorcycle Milestone Update",
    category: "Rewards",
    title: "Motorcycle Reward Progress Update",
    message: "Great news! You're making excellent progress toward your motorcycle reward!\n\nCurrent Status: [X] active tenants out of 50 required\nOnly [Y] more tenants to qualify!\n\nKeep up the momentum - you're doing fantastic work. The motorcycle reward is within reach!",
    priority: "normal"
  },
  {
    id: "system_update",
    name: "System Update Notification",
    category: "System",
    title: "System Maintenance Scheduled",
    message: "Please be informed that we have scheduled system maintenance this weekend.\n\nMaintenance Window: Saturday 11:00 PM - Sunday 6:00 AM\n\nDuring this time, the app may be temporarily unavailable. Please plan your activities accordingly and ensure all critical data is submitted before maintenance begins.\n\nThank you for your understanding.",
    priority: "urgent"
  },
  {
    id: "training_session",
    name: "Training Session Invitation",
    category: "Training",
    title: "Upcoming Training Session",
    message: "You're invited to attend our upcoming training session on advanced collection techniques and customer relationship management.\n\nDate: [Date]\nTime: [Time]\nLocation: [Location]\n\nThis training will help you improve your skills and increase your earnings. Please confirm your attendance by replying to this message.\n\nRefreshments will be provided.",
    priority: "normal"
  },
  {
    id: "policy_update",
    name: "Policy Update",
    category: "Policy",
    title: "Important Policy Update",
    message: "We have updated our operational policies effective immediately. Key changes include:\n\n• [Policy change 1]\n• [Policy change 2]\n• [Policy change 3]\n\nPlease review the updated policy document in your dashboard. If you have any questions, don't hesitate to reach out.\n\nThank you for your cooperation.",
    priority: "high"
  }
];

interface BulkMessageDialogProps {
  selectedAgentIds?: string[];
  agentNames?: string[];
  sendToAll?: boolean;
}

interface Tenant {
  id: string;
  tenant_name: string;
  agent_name: string;
}

export function BulkMessageDialog({ selectedAgentIds = [], agentNames = [], sendToAll = false }: BulkMessageDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showTemplates, setShowTemplates] = useState(true);
  const [customTemplates, setCustomTemplates] = useState<MessageTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<MessageTemplate[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchCustomTemplates();
      getCurrentUserId();
      fetchTenants();
    }
  }, [open]);

  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchTenants = async () => {
    try {
      const { data: tenantsData, error } = await supabase
        .from("tenants")
        .select(`
          id,
          tenant_name,
          agents!inner(
            profiles!inner(full_name)
          )
        `)
        .order("tenant_name");

      if (error) throw error;

      const formattedTenants = (tenantsData || []).map((t: any) => ({
        id: t.id,
        tenant_name: t.tenant_name,
        agent_name: t.agents?.profiles?.full_name || "Unknown Agent"
      }));

      setTenants(formattedTenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  const fetchCustomTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("custom_message_templates")
        .select(`
          *,
          profiles:manager_id (
            full_name,
            phone_number
          )
        `)
        .or(`manager_id.eq.${user.id},is_shared.eq.true`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const customTemplatesFormatted: MessageTemplate[] = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        title: t.title,
        message: t.message,
        priority: t.priority as "low" | "normal" | "high" | "urgent",
        category: t.category,
        isCustom: true,
        manager_id: t.manager_id,
        is_shared: t.is_shared,
        creator_name: t.profiles?.full_name || "Unknown",
      }));

      setCustomTemplates(customTemplatesFormatted);
      setAllTemplates([...MESSAGE_TEMPLATES, ...customTemplatesFormatted]);
    } catch (error: any) {
      console.error("Error fetching custom templates:", error);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      const { error } = await supabase
        .from("custom_message_templates")
        .delete()
        .eq("id", templateToDelete.id);

      if (error) throw error;

      toast.success("Template deleted successfully");
      fetchCustomTemplates();
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const handleToggleSharing = async (template: MessageTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || template.manager_id !== user.id) {
        toast.error("You can only share your own templates");
        return;
      }

      const newSharedState = !template.is_shared;
      const { error } = await supabase
        .from("custom_message_templates")
        .update({ 
          is_shared: newSharedState,
          shared_at: newSharedState ? new Date().toISOString() : null
        })
        .eq("id", template.id);

      if (error) throw error;

      toast.success(
        newSharedState 
          ? "Template shared with other managers" 
          : "Template is now private"
      );
      fetchCustomTemplates();
    } catch (error: any) {
      console.error("Error toggling template sharing:", error);
      toast.error("Failed to update sharing settings");
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (template) {
      setTitle(template.title);
      setMessage(template.message);
      setPriority(template.priority);
      setSelectedTemplate(templateId);
      setShowTemplates(false);
      toast.success("Template loaded", {
        description: "You can customize the message before sending"
      });
    }
  };

  const insertTenantTag = () => {
    if (!selectedTenantId) {
      toast.error("Please select a tenant first");
      return;
    }
    
    const tenant = tenants.find(t => t.id === selectedTenantId);
    if (!tenant) return;
    
    const tag = `[TENANT:${tenant.id}:${tenant.tenant_name}]`;
    setMessage(prev => prev + " " + tag);
    toast.success("Tenant tag inserted");
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setPriority("normal");
    setSelectedTemplate("");
    setShowTemplates(true);
    setSelectedTenantId("");
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let recipientUserIds: string[] = [];

      if (sendToAll) {
        const { data: allAgents, error: agentsError } = await supabase
          .from("agents")
          .select("user_id");
        
        if (agentsError) throw agentsError;
        recipientUserIds = allAgents?.map(a => a.user_id) || [];
      } else {
        if (selectedAgentIds.length === 0) {
          toast.error("No agents selected");
          return;
        }

        const { data: agents, error: agentsError } = await supabase
          .from("agents")
          .select("user_id")
          .in("id", selectedAgentIds);

        if (agentsError) throw agentsError;
        recipientUserIds = agents?.map(a => a.user_id) || [];
      }

      const notifications = recipientUserIds.map(recipientId => ({
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

      const count = sendToAll ? recipientUserIds.length : selectedAgentIds.length;
      toast.success(`Message sent to ${count} agent(s)`, {
        description: `"${title}" was delivered successfully`
      });

      resetForm();
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="default" 
            size="sm"
            disabled={!sendToAll && selectedAgentIds.length === 0}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {sendToAll ? "Message All Agents" : `Send Message${selectedAgentIds.length > 0 ? ` (${selectedAgentIds.length})` : ""}`}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Message to Agents</DialogTitle>
            <DialogDescription>
              {sendToAll 
                ? "Send a message to all agents in the system"
                : `Send an in-app message to ${selectedAgentIds.length} selected agent(s): ${agentNames.slice(0, 3).join(", ")}${agentNames.length > 3 ? ` and ${agentNames.length - 3} more` : ""}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {showTemplates ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Choose a Template</Label>
                  <div className="flex items-center gap-2">
                    <CustomTemplateDialog onTemplateSaved={fetchCustomTemplates} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTemplates(false)}
                    >
                      Start from scratch
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {allTemplates.reduce((acc, template) => {
                    const categoryExists = acc.find((item: any) => item.category === template.category);
                    if (!categoryExists) {
                      const categoryTemplates = allTemplates.filter(t => t.category === template.category);
                      acc.push({
                        category: template.category,
                        templates: categoryTemplates
                      });
                    }
                    return acc;
                  }, [] as any[]).map((group) => (
                    <div key={group.category} className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        {group.category}
                        {group.templates.some((t: MessageTemplate) => t.isCustom) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Custom</span>
                        )}
                      </h4>
                      {group.templates.map((template: MessageTemplate) => (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors border-2 relative group"
                        >
                          <CardContent className="p-4" onClick={() => handleTemplateSelect(template.id)}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <FileText className="h-4 w-4 text-primary" />
                                  <h5 className="font-medium">{template.name}</h5>
                                  {template.isCustom && template.manager_id === currentUserId && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">You</span>
                                  )}
                                  {template.is_shared && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                                      <Share2 className="h-3 w-3" />
                                      Shared
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {template.title}
                                </p>
                                {template.isCustom && template.creator_name && template.manager_id !== currentUserId && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Created by: {template.creator_name}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <div className={`text-xs px-2 py-1 rounded ${
                                  template.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                                  template.priority === "high" ? "bg-orange-100 text-orange-700" :
                                  template.priority === "low" ? "bg-muted text-muted-foreground" :
                                  "bg-primary/10 text-primary"
                                }`}>
                                  {template.priority}
                                </div>
                                {template.isCustom && template.manager_id === currentUserId && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleSharing(template);
                                      }}
                                      title={template.is_shared ? "Make private" : "Share with other managers"}
                                    >
                                      {template.is_shared ? (
                                        <Lock className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <Share2 className="h-4 w-4 text-green-600" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTemplateToDelete(template);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    {selectedTemplate ? "Customize Message" : "Compose Message"}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      resetForm();
                      setShowTemplates(true);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                </div>
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
                  <Label htmlFor="tenant">Tag Tenant (Optional)</Label>
                  <div className="flex gap-2">
                    <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tenant to tag..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.tenant_name} (Agent: {tenant.agent_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={insertTenantTag}
                      disabled={!selectedTenantId}
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      Insert Tag
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Insert a clickable tenant tag into your message
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message here... Use the tenant selector above to insert clickable tenant tags."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                    maxLength={1000}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {message.length}/1000 characters
                  </p>
                </div>
              </>
            )}
          </div>

          {!showTemplates && (
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
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
                    {sendToAll ? "Send to All Agents" : `Send to ${selectedAgentIds.length} Agent${selectedAgentIds.length !== 1 ? "s" : ""}`}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

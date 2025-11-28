import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send, FileText, Trash2, Share2, Lock, Tag, Code2, Eye, Save, FolderOpen } from "lucide-react";
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
import { format } from "date-fns";

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

interface MessageDraft {
  id: string;
  draft_name: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  send_to_all: boolean;
  selected_agent_ids: string[];
  created_at: string;
  updated_at: string;
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
  const [showVariableHelper, setShowVariableHelper] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAgentId, setPreviewAgentId] = useState<string>("");
  const [previewMessage, setPreviewMessage] = useState<string>("");
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [drafts, setDrafts] = useState<MessageDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Available template variables
  const TEMPLATE_VARIABLES = [
    { key: "{{AGENT_NAME}}", description: "Agent's full name", example: "John Doe" },
    { key: "{{AGENT_PHONE}}", description: "Agent's phone number", example: "+256 700 123456" },
    { key: "{{TENANT_COUNT}}", description: "Number of active tenants", example: "15" },
    { key: "{{PORTFOLIO_VALUE}}", description: "Current portfolio value", example: "UGX 5,000,000" },
    { key: "{{COLLECTION_RATE}}", description: "Collection rate percentage", example: "85%" },
    { key: "{{MOTORCYCLE_PROGRESS}}", description: "Progress toward motorcycle reward", example: "30/50 tenants" },
  ];

  useEffect(() => {
    if (open) {
      fetchCustomTemplates();
      getCurrentUserId();
      fetchTenants();
      fetchAvailableAgents();
      fetchDrafts();
    }
  }, [open]);

  // Update preview when message or preview agent changes
  useEffect(() => {
    if (showPreview && previewAgentId && message) {
      updatePreview();
    }
  }, [message, previewAgentId, showPreview]);

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

  const fetchAvailableAgents = async () => {
    try {
      let agentIds: string[] = [];

      if (sendToAll) {
        const { data: allAgents, error } = await supabase
          .from("agents")
          .select(`
            id,
            profiles:user_id(full_name)
          `);
        
        if (error) throw error;
        
        setAvailableAgents(
          (allAgents || []).map((a: any) => ({
            id: a.id,
            name: a.profiles?.full_name || "Unknown Agent"
          }))
        );
      } else if (selectedAgentIds.length > 0) {
        const { data: agents, error } = await supabase
          .from("agents")
          .select(`
            id,
            profiles:user_id(full_name)
          `)
          .in("id", selectedAgentIds);
        
        if (error) throw error;
        
        setAvailableAgents(
          (agents || []).map((a: any) => ({
            id: a.id,
            name: a.profiles?.full_name || "Unknown Agent"
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching available agents:", error);
    }
  };

  const updatePreview = async () => {
    if (!previewAgentId || !message) {
      setPreviewMessage("");
      return;
    }

    setLoadingPreview(true);
    try {
      const processed = await replaceVariablesForAgent(message, previewAgentId);
      setPreviewMessage(processed);
    } catch (error) {
      console.error("Error generating preview:", error);
      setPreviewMessage(message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const fetchDrafts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("message_drafts")
        .select("*")
        .eq("manager_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setDrafts((data || []) as MessageDraft[]);
    } catch (error) {
      console.error("Error fetching drafts:", error);
    }
  };

  const saveDraft = async () => {
    if (!title.trim() && !message.trim()) {
      toast.error("Cannot save empty draft");
      return;
    }

    const draftName = prompt("Enter a name for this draft:", currentDraftId ? drafts.find(d => d.id === currentDraftId)?.draft_name : `Draft - ${new Date().toLocaleDateString()}`);
    
    if (!draftName || !draftName.trim()) {
      toast.error("Draft name is required");
      return;
    }

    setSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const draftData = {
        manager_id: user.id,
        draft_name: draftName.trim(),
        title,
        message,
        priority,
        send_to_all: sendToAll,
        selected_agent_ids: selectedAgentIds,
      };

      if (currentDraftId) {
        // Update existing draft
        const { error } = await supabase
          .from("message_drafts")
          .update(draftData)
          .eq("id", currentDraftId);

        if (error) throw error;
        toast.success("Draft updated successfully");
      } else {
        // Create new draft
        const { error } = await supabase
          .from("message_drafts")
          .insert(draftData);

        if (error) throw error;
        toast.success("Draft saved successfully");
      }

      await fetchDrafts();
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const loadDraft = (draft: MessageDraft) => {
    setTitle(draft.title);
    setMessage(draft.message);
    setPriority(draft.priority);
    setCurrentDraftId(draft.id);
    setShowDrafts(false);
    setShowTemplates(false);
    toast.success(`Loaded draft: ${draft.draft_name}`);
  };

  const deleteDraft = async (draftId: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;

    try {
      const { error } = await supabase
        .from("message_drafts")
        .delete()
        .eq("id", draftId);

      if (error) throw error;

      toast.success("Draft deleted");
      await fetchDrafts();
      
      if (currentDraftId === draftId) {
        setCurrentDraftId(null);
      }
    } catch (error) {
      console.error("Error deleting draft:", error);
      toast.error("Failed to delete draft");
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

  const insertVariable = (variable: string) => {
    setMessage(prev => prev + " " + variable);
    toast.success("Variable inserted");
  };

  const replaceVariablesForAgent = async (messageText: string, agentId: string): Promise<string> => {
    try {
      // Fetch agent data
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone_number
          )
        `)
        .eq("id", agentId)
        .single();

      if (agentError) throw agentError;

      // Fetch tenant count for this agent
      const { count: tenantCount } = await supabase
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", agentId);

      // Calculate motorcycle progress
      const activeTenants = tenantCount || 0;
      const motorcycleProgress = `${activeTenants}/50 tenants`;

      // Replace all variables
      let processedMessage = messageText
        .replace(/\{\{AGENT_NAME\}\}/g, agent.profiles?.full_name || "Agent")
        .replace(/\{\{AGENT_PHONE\}\}/g, agent.profiles?.phone_number || "N/A")
        .replace(/\{\{TENANT_COUNT\}\}/g, String(tenantCount || 0))
        .replace(/\{\{PORTFOLIO_VALUE\}\}/g, `UGX ${Number(agent.portfolio_value || 0).toLocaleString()}`)
        .replace(/\{\{COLLECTION_RATE\}\}/g, `${Number(agent.collection_rate || 0).toFixed(1)}%`)
        .replace(/\{\{MOTORCYCLE_PROGRESS\}\}/g, motorcycleProgress);

      return processedMessage;
    } catch (error) {
      console.error("Error replacing variables for agent:", error);
      return messageText; // Return original message if error
    }
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setPriority("normal");
    setSelectedTemplate("");
    setShowTemplates(true);
    setSelectedTenantId("");
    setShowVariableHelper(false);
    setShowPreview(false);
    setPreviewAgentId("");
    setPreviewMessage("");
    setCurrentDraftId(null);
    setShowDrafts(false);
    setSaveAsTemplate(false);
    setTemplateName("");
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (saveAsTemplate && !templateName.trim()) {
      toast.error("Please provide a name for the template");
      return;
    }

    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let agentIds: string[] = [];

      if (sendToAll) {
        const { data: allAgents, error: agentsError } = await supabase
          .from("agents")
          .select("id, user_id");
        
        if (agentsError) throw agentsError;
        agentIds = allAgents?.map(a => a.id) || [];
      } else {
        if (selectedAgentIds.length === 0) {
          toast.error("No agents selected");
          return;
        }
        agentIds = selectedAgentIds;
      }

      // Get agent data with user_ids
      const { data: agentsData, error: agentsError } = await supabase
        .from("agents")
        .select("id, user_id")
        .in("id", agentIds);

      if (agentsError) throw agentsError;

      // Process messages with variable replacement for each agent
      const notifications = await Promise.all(
        (agentsData || []).map(async (agent) => {
          const personalizedMessage = await replaceVariablesForAgent(message, agent.id);
          
          return {
            sender_id: user.id,
            recipient_id: agent.user_id,
            title,
            message: personalizedMessage,
            priority,
          };
        })
      );

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) throw insertError;

      // Save as template if requested
      if (saveAsTemplate) {
        const { error: templateError } = await supabase
          .from("custom_message_templates")
          .insert({
            manager_id: user.id,
            name: templateName,
            title: title,
            message: message,
            category: "custom",
            priority: priority,
            is_shared: true,
            shared_at: new Date().toISOString(),
          });

        if (templateError) {
          console.error("Error saving template:", templateError);
          toast.error("Message sent but failed to save as template");
        } else {
          toast.success(`Message sent and saved as template "${templateName}"`);
        }
      } else {
        const count = sendToAll ? agentIds.length : selectedAgentIds.length;
        toast.success(`Message sent to ${count} agent(s)`, {
          description: `"${title}" was delivered successfully`
        });
      }

      // Delete draft if we were editing one
      if (currentDraftId) {
        await supabase.from("message_drafts").delete().eq("id", currentDraftId);
      }

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
                  <Label className="text-base font-semibold">Choose a Template or Draft</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDrafts(!showDrafts)}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      {showDrafts ? "Show Templates" : `Drafts (${drafts.length})`}
                    </Button>
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
                
                {showDrafts ? (
                  // Show Drafts
                  <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {drafts.length === 0 ? (
                      <Card>
                        <CardContent className="p-6 text-center">
                          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No saved drafts</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Save incomplete messages as drafts to continue later
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      drafts.map((draft) => (
                        <Card
                          key={draft.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors border-2 relative group"
                        >
                          <CardContent className="p-4" onClick={() => loadDraft(draft)}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <FolderOpen className="h-4 w-4 text-primary" />
                                  <h5 className="font-medium">{draft.draft_name}</h5>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                    Draft
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {draft.title || "Untitled"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Updated: {format(new Date(draft.updated_at), "MMM d, h:mm a")}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className={`text-xs px-2 py-1 rounded ${
                                  draft.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                                  draft.priority === "high" ? "bg-orange-100 text-orange-700" :
                                  draft.priority === "low" ? "bg-muted text-muted-foreground" :
                                  "bg-primary/10 text-primary"
                                }`}>
                                  {draft.priority}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteDraft(draft.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  // Show Templates
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
                )}
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

                {/* Template Variables Helper */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Template Variables</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowVariableHelper(!showVariableHelper)}
                    >
                      <Code2 className="h-4 w-4 mr-2" />
                      {showVariableHelper ? "Hide" : "Show"} Variables
                    </Button>
                  </div>
                  
                  {showVariableHelper && (
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Click a variable to insert it. Variables will be replaced with agent-specific data when sent.
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {TEMPLATE_VARIABLES.map((variable) => (
                            <div
                              key={variable.key}
                              className="flex items-start justify-between gap-2 p-2 rounded hover:bg-background cursor-pointer transition-colors"
                              onClick={() => insertVariable(variable.key)}
                            >
                              <div className="flex-1 min-w-0">
                                <code className="text-xs font-mono bg-background px-2 py-1 rounded">
                                  {variable.key}
                                </code>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {variable.description}
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
                                ex: {variable.example}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
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

                {/* Message Preview Section */}
                {message && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Message Preview</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowPreview(!showPreview);
                          if (!showPreview && availableAgents.length > 0 && !previewAgentId) {
                            setPreviewAgentId(availableAgents[0].id);
                          }
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {showPreview ? "Hide" : "Show"} Preview
                      </Button>
                    </div>

                    {showPreview && (
                      <Card className="bg-muted/50">
                        <CardContent className="p-4 space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="preview-agent" className="text-xs">
                              Preview as Agent:
                            </Label>
                            <Select value={previewAgentId} onValueChange={setPreviewAgentId}>
                              <SelectTrigger id="preview-agent">
                                <SelectValue placeholder="Select an agent to preview..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                {availableAgents.map((agent) => (
                                  <SelectItem key={agent.id} value={agent.id}>
                                    {agent.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {previewAgentId && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">
                                How this message will appear:
                              </Label>
                              <div className="bg-background rounded-md p-4 border border-border">
                                {loadingPreview ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    Generating preview...
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="text-sm font-semibold">{title || "Subject"}</div>
                                    <div className="text-sm whitespace-pre-wrap">
                                      {previewMessage || message}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Variables and tenant tags will be replaced with actual data when sent
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!showTemplates && (
            <>
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="saveAsTemplate"
                    checked={saveAsTemplate}
                    onCheckedChange={(checked) => setSaveAsTemplate(checked as boolean)}
                  />
                  <label
                    htmlFor="saveAsTemplate"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Save this message as a reusable template
                  </label>
                </div>

                {saveAsTemplate && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="templateName">Template Name</Label>
                    <Input
                      id="templateName"
                      placeholder="e.g., Weekly Performance Update"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Give your template a descriptive name to easily find it later
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setOpen(false);
                  }}
                  disabled={sending || savingDraft}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={saveDraft}
                  disabled={sending || savingDraft || (!title.trim() && !message.trim())}
                >
                  {savingDraft ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {currentDraftId ? "Update Draft" : "Save as Draft"}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sending || savingDraft || !title.trim() || !message.trim()}
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
            </>
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

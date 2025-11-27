import { useState, useRef, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, User, Loader2, History, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const AIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant for rent collection. Ask me anything about best practices, handling tenants, or improving your collection rates.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    loadAgentId();
    loadConversations();
  }, []);

  const loadAgentId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (agent) {
        setAgentId(agent.id);
      }
    }
  };

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!agent) return;

    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('agent_id', agent.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
    } else {
      setConversations(data || []);
    }
  };

  const saveMessage = async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    const { error } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role, content });

    if (error) {
      console.error('Error saving message:', error);
    }
  };

  const createNewConversation = async (firstMessage: string) => {
    if (!agentId) return null;

    const title = firstMessage.length > 50 
      ? firstMessage.substring(0, 47) + '...'
      : firstMessage;

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ agent_id: agentId, title })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    await loadConversations();
    return data.id;
  };

  const loadConversation = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load conversation');
      return;
    }

    const loadedMessages: Message[] = data.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    setMessages(loadedMessages);
    setCurrentConversationId(conversationId);
    setIsHistoryOpen(false);
    toast.success('Conversation loaded');
  };

  const startNewConversation = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Hello! I\'m your AI assistant for rent collection. Ask me anything about best practices, handling tenants, or improving your collection rates.',
      },
    ]);
    setCurrentConversationId(null);
    setIsHistoryOpen(false);
  };

  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
      return;
    }

    if (currentConversationId === conversationId) {
      startNewConversation();
    }

    await loadConversations();
    toast.success('Conversation deleted');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const userInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Create new conversation if this is the first message
      let conversationId = currentConversationId;
      if (!conversationId && messages.length === 1) {
        conversationId = await createNewConversation(userInput);
        if (conversationId) {
          setCurrentConversationId(conversationId);
        }
      }

      // Save user message
      if (conversationId) {
        await saveMessage(conversationId, 'user', userInput);
      }

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })) }
      });

      if (error) throw error;

      if (data?.choices?.[0]?.message?.content) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.choices[0].message.content,
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Save assistant message
        if (conversationId) {
          await saveMessage(conversationId, 'assistant', assistantMessage.content);
          
          // Update conversation timestamp
          await supabase
            .from('chat_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
          
          await loadConversations();
        }
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "How do I handle a tenant who is consistently late?",
    "What's the best way to remind tenants about upcoming rent?",
    "How can I improve my collection rate?",
    "Tips for documenting rent payments?",
  ];

  return (
    <AgentLayout currentPage="/agent/ai-assistant">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">AI Assistant</h1>
            <p className="text-muted-foreground">Get expert advice on rent collection</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startNewConversation}>
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
            <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="w-4 h-4 mr-2" />
                  History
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Chat History</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                  <div className="space-y-2">
                    {conversations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No previous conversations
                      </p>
                    ) : (
                      conversations.map((conv) => (
                        <Card
                          key={conv.id}
                          className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                            currentConversationId === conv.id ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div
                              className="flex-1 min-w-0"
                              onClick={() => loadConversation(conv.id)}
                            >
                              <h3 className="font-medium text-sm truncate">
                                {conv.title}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(conv.updated_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {messages.length === 1 && (
            <div className="p-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Try asking:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-left h-auto py-2 px-3 text-xs"
                    onClick={() => setInput(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about rent collection..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default AIAssistant;

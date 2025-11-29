import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon, Search, Plus, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  outstanding_balance: number;
  rent_amount: number;
  agent_id: string;
  agents: {
    user_id: string;
    profiles: {
      full_name: string;
    };
  };
}

interface PaymentEntry {
  id: string;
  tenant: Tenant | null;
  amount: string;
  paymentMethod: string;
  paymentDate: Date;
}

interface BatchPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BatchPaymentDialog({ open, onOpenChange }: BatchPaymentDialogProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { id: crypto.randomUUID(), tenant: null, amount: "", paymentMethod: "cash", paymentDate: new Date() }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchOpen, setSearchOpen] = useState<string | null>(null);
  const [processingSummary, setProcessingSummary] = useState<{ success: number; failed: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTenants();
      setProcessingSummary(null);
    }
  }, [open]);

  const fetchTenants = async () => {
    const { data, error } = await supabase
      .from("tenants")
      .select(`
        id,
        tenant_name,
        tenant_phone,
        outstanding_balance,
        rent_amount,
        agent_id,
        agents!inner(
          user_id,
          profiles!inner(full_name)
        )
      `)
      .eq("status", "verified")
      .order("tenant_name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load tenants",
        variant: "destructive",
      });
      return;
    }

    setTenants(data || []);
  };

  const addPaymentEntry = () => {
    setPayments([
      ...payments,
      { id: crypto.randomUUID(), tenant: null, amount: "", paymentMethod: "cash", paymentDate: new Date() }
    ]);
  };

  const removePaymentEntry = (id: string) => {
    if (payments.length === 1) {
      toast({
        title: "Cannot remove",
        description: "At least one payment entry is required",
        variant: "destructive",
      });
      return;
    }
    setPayments(payments.filter(p => p.id !== id));
  };

  const updatePaymentEntry = (id: string, field: keyof PaymentEntry, value: any) => {
    setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const processPayments = async () => {
    // Validate all entries
    const invalidEntries = payments.filter(p => !p.tenant || !p.amount);
    if (invalidEntries.length > 0) {
      toast({
        title: "Incomplete entries",
        description: `${invalidEntries.length} payment(s) missing tenant or amount`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    let successCount = 0;
    let failedCount = 0;

    // Get current manager info once
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    const { data: managerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Process each payment
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      
      try {
        const paymentAmount = parseFloat(payment.amount);
        const commission = paymentAmount * 0.05;
        const previousBalance = payment.tenant!.outstanding_balance || 0;
        const newBalance = Math.max(0, previousBalance - paymentAmount);

        // Insert collection record
        const { data: collectionData, error: collectionError } = await supabase
          .from("collections")
          .insert({
            tenant_id: payment.tenant!.id,
            agent_id: payment.tenant!.agent_id,
            amount: paymentAmount,
            commission: commission,
            payment_method: payment.paymentMethod,
            collection_date: format(payment.paymentDate, "yyyy-MM-dd"),
            status: "pending",
          })
          .select()
          .single();

        if (collectionError) throw collectionError;

        // Update tenant balance
        const { error: updateError } = await supabase
          .from("tenants")
          .update({ 
            outstanding_balance: newBalance,
            last_payment_date: new Date().toISOString(),
          })
          .eq("id", payment.tenant!.id);

        if (updateError) throw updateError;

        // Send notification to agent
        await supabase
          .from("notifications")
          .insert({
            sender_id: user.id,
            recipient_id: payment.tenant!.agents.user_id,
            title: "Payment Recorded by Manager",
            message: `Manager ${managerProfile?.full_name || "Unknown"} recorded a payment of UGX ${paymentAmount.toLocaleString()} for tenant ${payment.tenant!.tenant_name}.`,
            priority: "high",
            payment_data: {
              collection_id: collectionData.id,
              tenant_id: payment.tenant!.id,
              tenant_name: payment.tenant!.tenant_name,
              tenant_phone: payment.tenant!.tenant_phone,
              amount: paymentAmount,
              payment_method: payment.paymentMethod,
              payment_date: format(payment.paymentDate, "yyyy-MM-dd"),
              previous_balance: previousBalance,
              new_balance: newBalance,
              commission: commission,
              recorded_by: "manager",
              manager_name: managerProfile?.full_name || "Unknown Manager",
            },
          });

        successCount++;
      } catch (error) {
        console.error(`Error processing payment for ${payment.tenant?.tenant_name}:`, error);
        failedCount++;
      }

      setProgress(((i + 1) / payments.length) * 100);
    }

    setProcessingSummary({ success: successCount, failed: failedCount });
    setIsProcessing(false);

    if (failedCount === 0) {
      toast({
        title: "Batch complete",
        description: `Successfully recorded ${successCount} payment(s)`,
      });
      
      // Reset form after short delay
      setTimeout(() => {
        setPayments([{ id: crypto.randomUUID(), tenant: null, amount: "", paymentMethod: "cash", paymentDate: new Date() }]);
        setProcessingSummary(null);
        onOpenChange(false);
      }, 2000);
    } else {
      toast({
        title: "Batch completed with errors",
        description: `${successCount} succeeded, ${failedCount} failed`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Payment Recording</DialogTitle>
        </DialogHeader>

        {isProcessing && (
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Processing payments...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {processingSummary && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex gap-4 justify-center">
                <div className="text-center">
                  <Badge variant="default" className="mb-2">Success</Badge>
                  <p className="text-2xl font-bold text-green-600">{processingSummary.success}</p>
                </div>
                <div className="text-center">
                  <Badge variant="destructive" className="mb-2">Failed</Badge>
                  <p className="text-2xl font-bold text-red-600">{processingSummary.failed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {payments.map((payment, index) => (
            <Card key={payment.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">Payment {index + 1}</Badge>
                      {payments.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePaymentEntry(payment.id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tenant</Label>
                        <Popover 
                          open={searchOpen === payment.id} 
                          onOpenChange={(open) => setSearchOpen(open ? payment.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                              disabled={isProcessing}
                            >
                              {payment.tenant ? payment.tenant.tenant_name : "Select tenant..."}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search tenant..." />
                              <CommandEmpty>No tenant found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {tenants.map((tenant) => (
                                  <CommandItem
                                    key={tenant.id}
                                    value={tenant.tenant_name}
                                    onSelect={() => {
                                      updatePaymentEntry(payment.id, "tenant", tenant);
                                      setSearchOpen(null);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{tenant.tenant_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        Balance: UGX {tenant.outstanding_balance?.toLocaleString()}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>Amount (UGX)</Label>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          value={payment.amount}
                          onChange={(e) => updatePaymentEntry(payment.id, "amount", e.target.value)}
                          disabled={isProcessing}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select 
                          value={payment.paymentMethod} 
                          onValueChange={(value) => updatePaymentEntry(payment.id, "paymentMethod", value)}
                          disabled={isProcessing}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                            <SelectItem value="airtel">Airtel Money</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Payment Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !payment.paymentDate && "text-muted-foreground"
                              )}
                              disabled={isProcessing}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {payment.paymentDate ? format(payment.paymentDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={payment.paymentDate}
                              onSelect={(date) => date && updatePaymentEntry(payment.id, "paymentDate", date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {payment.tenant && payment.amount && (
                      <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Outstanding Balance:</span>
                          <span className="font-semibold">UGX {payment.tenant.outstanding_balance?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Commission (5%):</span>
                          <span>UGX {(parseFloat(payment.amount) * 0.05).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addPaymentEntry}
            disabled={isProcessing}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Payment
          </Button>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={processPayments} 
            className="flex-1"
            disabled={isProcessing}
          >
            <Save className="h-4 w-4 mr-2" />
            {isProcessing ? "Processing..." : `Record ${payments.length} Payment${payments.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

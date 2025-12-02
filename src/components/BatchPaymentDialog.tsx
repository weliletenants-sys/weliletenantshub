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
import { CalendarIcon, Search, Plus, Trash2, Save, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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
  paymentId: string;
  paymentDate: Date;
  paymentTime: { hours: string; minutes: string };
  tidExists?: boolean;
  checkingTid?: boolean;
  tidFormatError?: string;
}

interface BatchPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BatchPaymentDialog({ open, onOpenChange }: BatchPaymentDialogProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { id: crypto.randomUUID(), tenant: null, amount: "", paymentMethod: "cash", paymentId: "", paymentDate: new Date(), paymentTime: { hours: new Date().getHours().toString().padStart(2, '0'), minutes: new Date().getMinutes().toString().padStart(2, '0') } }
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

  // Validate TID format for batch payments
  const validateBatchTidFormat = (tid: string, method: string): string => {
    if (!tid || tid.trim().length === 0) {
      return "Transaction ID is required";
    }
    
    if (method === "mtn") {
      const mtnPattern = /^MTN-\d{11}$/;
      if (!mtnPattern.test(tid)) {
        return "MTN Transaction ID must be 11 digits: MTN-XXXXXXXXXXX (e.g., MTN-12345678901)";
      }
    } else if (method === "airtel") {
      const airtelPattern = /^ATL-\d{12}$/;
      if (!airtelPattern.test(tid)) {
        return "Airtel Transaction ID must be 12 digits: ATL-XXXXXXXXXXXX (e.g., ATL-123456789012)";
      }
    }
    return "";
  };

  // Real-time TID duplicate check for all payments
  useEffect(() => {
    const checkAllTids = async () => {
      const updatedPayments = [...payments];
      let hasChanges = false;

      for (let i = 0; i < updatedPayments.length; i++) {
        const payment = updatedPayments[i];
        
        // Check format first
        const formatError = validateBatchTidFormat(payment.paymentId, payment.paymentMethod);
        if (payment.tidFormatError !== formatError) {
          updatedPayments[i] = { ...payment, tidFormatError: formatError };
          hasChanges = true;
        }

        if (formatError || !payment.paymentId || payment.paymentId.length < 3) {
          if (payment.tidExists !== false || payment.checkingTid !== false) {
            updatedPayments[i] = { ...updatedPayments[i], tidExists: false, checkingTid: false };
            hasChanges = true;
          }
          continue;
        }

        // Mark as checking
        if (!payment.checkingTid) {
          updatedPayments[i] = { ...payment, checkingTid: true };
          hasChanges = true;
        }

        try {
          const { data, error } = await supabase
            .from("collections")
            .select("id")
            .eq("payment_id", payment.paymentId)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            console.error("Error checking TID:", error);
          }

          const exists = !!data;
          if (payment.tidExists !== exists || payment.checkingTid !== false) {
            updatedPayments[i] = { ...payment, tidExists: exists, checkingTid: false };
            hasChanges = true;
          }
        } catch (error) {
          console.error("Error checking TID:", error);
          if (payment.checkingTid !== false) {
            updatedPayments[i] = { ...payment, checkingTid: false };
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        setPayments(updatedPayments);
      }
    };

    // Debounce the check by 500ms
    const timeoutId = setTimeout(checkAllTids, 500);
    return () => clearTimeout(timeoutId);
  }, [payments.map(p => p.paymentId).join(',')]); // Only re-run when TIDs change

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
          profiles!agents_user_id_fkey(full_name)
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
      { id: crypto.randomUUID(), tenant: null, amount: "", paymentMethod: "cash", paymentId: "", paymentDate: new Date(), paymentTime: { hours: new Date().getHours().toString().padStart(2, '0'), minutes: new Date().getMinutes().toString().padStart(2, '0') } }
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
    // Validate all entries have tenant, amount, AND Transaction ID
    const invalidEntries = payments.filter(p => !p.tenant || !p.amount || !p.paymentId);
    if (invalidEntries.length > 0) {
      toast({
        title: "Incomplete entries",
        description: `${invalidEntries.length} payment(s) missing tenant, amount, or Transaction ID (TID)`,
        variant: "destructive",
      });
      return;
    }

    // Check for format errors
    const formatErrors = payments.filter(p => p.tidFormatError);
    if (formatErrors.length > 0) {
      toast({
        title: "Invalid Transaction ID Format",
        description: `${formatErrors.length} payment(s) have invalid TID format. Please fix before submitting.`,
        variant: "destructive",
      });
      return;
    }

    // Check for any duplicate TIDs detected
    const duplicateEntries = payments.filter(p => p.tidExists);
    if (duplicateEntries.length > 0) {
      toast({
        title: "Duplicate Transaction IDs",
        description: `${duplicateEntries.length} payment(s) have duplicate TIDs. Please use unique TIDs for all entries.`,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate TIDs within batch
    const tidSet = new Set();
    const duplicateTids: string[] = [];
    payments.forEach(p => {
      if (p.paymentId && tidSet.has(p.paymentId)) {
        duplicateTids.push(p.paymentId);
      }
      tidSet.add(p.paymentId);
    });

    if (duplicateTids.length > 0) {
      toast({
        title: "Duplicate Transaction IDs",
        description: `Found duplicate TIDs in batch: ${duplicateTids.join(", ")}. Each TID must be unique.`,
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

        // Combine date and time into timestamp
        const dateTime = new Date(payment.paymentDate);
        dateTime.setHours(parseInt(payment.paymentTime.hours), parseInt(payment.paymentTime.minutes), 0, 0);

        // Insert collection record
        const { data: collectionData, error: collectionError } = await supabase
          .from("collections")
          .insert({
            tenant_id: payment.tenant!.id,
            agent_id: payment.tenant!.agent_id,
            amount: paymentAmount,
            commission: commission,
            payment_method: payment.paymentMethod,
            payment_id: payment.paymentId.trim(), // TID is now mandatory
            collection_date: dateTime.toISOString(),
            status: "pending", // Will be auto-verified by trigger
            created_by: user.id,
            created_by_manager: true, // Manager payment - auto-verify
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
            title: "💰 Payment Recorded - Commission Earned!",
            message: `Manager ${managerProfile?.full_name || "Unknown"} recorded a payment of UGX ${paymentAmount.toLocaleString()} for tenant ${payment.tenant!.tenant_name}.

🎉 You earned UGX ${commission.toLocaleString()} commission (5%)!

Tenant Balance: UGX ${previousBalance.toLocaleString()} → UGX ${newBalance.toLocaleString()}

You can generate and share the receipt with your tenant from the payment notification.`,
            priority: "high",
            payment_data: {
              collection_id: collectionData.id,
              tenant_id: payment.tenant!.id,
              tenant_name: payment.tenant!.tenant_name,
              tenant_phone: payment.tenant!.tenant_phone,
              amount: paymentAmount,
              payment_method: payment.paymentMethod,
              payment_id: payment.paymentId || undefined,
              payment_date: dateTime.toISOString(),
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
        setPayments([{ id: crypto.randomUUID(), tenant: null, amount: "", paymentMethod: "cash", paymentId: "", paymentDate: new Date(), paymentTime: { hours: new Date().getHours().toString().padStart(2, '0'), minutes: new Date().getMinutes().toString().padStart(2, '0') } }]);
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
                        <Label>Transaction ID (TID) *</Label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="Enter unique transaction ID"
                            value={payment.paymentId}
                            onChange={(e) => updatePaymentEntry(payment.id, "paymentId", e.target.value)}
                            disabled={isProcessing}
                      required
                      className={cn(
                        (payment.tidExists || payment.tidFormatError) && "border-destructive focus-visible:ring-destructive",
                        payment.checkingTid && "pr-10"
                      )}
                          />
                          {payment.checkingTid && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                         {payment.tidFormatError && (
                          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-destructive font-medium">
                              {payment.tidFormatError}
                            </p>
                          </div>
                        )}
                        {payment.tidExists && !payment.tidFormatError && (
                          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-destructive font-medium">
                              This Transaction ID already exists in the system. Please use a different TID.
                            </p>
                          </div>
                        )}
                        {!payment.tidExists && !payment.tidFormatError && payment.paymentId && !payment.checkingTid && payment.paymentId.length >= 3 && (
                          <div className="flex items-center gap-2 text-xs text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            TID available
                          </div>
                        )}
                        {!payment.tidExists && !payment.tidFormatError && (
                          <p className="text-xs text-muted-foreground">
                            {payment.paymentMethod === "mtn" && "Format: MTN-XXXXX (e.g., MTN-12345)"}
                            {payment.paymentMethod === "airtel" && "Format: ATL-XXXXX (e.g., ATL-12345)"}
                            {payment.paymentMethod === "cash" && "Required to prevent double entry"}
                          </p>
                        )}
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
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>Payment Time</Label>
                        <div className="flex gap-2">
                          <Select 
                            value={payment.paymentTime.hours} 
                            onValueChange={(val) => updatePaymentEntry(payment.id, "paymentTime", { ...payment.paymentTime, hours: val })}
                            disabled={isProcessing}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="HH" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((hour) => (
                                <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-2xl font-bold self-center">:</span>
                          <Select 
                            value={payment.paymentTime.minutes} 
                            onValueChange={(val) => updatePaymentEntry(payment.id, "paymentTime", { ...payment.paymentTime, minutes: val })}
                            disabled={isProcessing}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="MM" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map((minute) => (
                                <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
            disabled={isProcessing || payments.some(p => p.tidExists || p.checkingTid)}
          >
            <Save className="h-4 w-4 mr-2" />
            {isProcessing ? "Processing..." : `Record ${payments.length} Payment${payments.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

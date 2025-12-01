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
import { haptics } from "@/utils/haptics";
import { format } from "date-fns";
import { CalendarIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

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

interface ManagerPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManagerPaymentDialog({ open, onOpenChange }: ManagerPaymentDialogProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentId, setPaymentId] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentTime, setPaymentTime] = useState({ hours: new Date().getHours().toString().padStart(2, '0'), minutes: new Date().getMinutes().toString().padStart(2, '0') });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTenants();
    }
  }, [open]);

  const fetchTenants = async () => {
    const { data: tenantsData, error: tenantsError } = await supabase
      .from("tenants")
      .select(`
        *,
        agents!inner (
          user_id,
          profiles!agents_user_id_fkey (full_name)
        )
      `)
      .order("tenant_name");

    if (tenantsError) {
      toast({
        title: "Error",
        description: "Failed to load tenants",
        variant: "destructive",
      });
      return;
    }

    setTenants(tenantsData || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.light(); // Form submission attempt
    
    if (!selectedTenant || !amount) {
      haptics.error(); // Validation error
      toast({
        title: "Missing information",
        description: "Please select a tenant and enter an amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const paymentAmount = parseFloat(amount);
      const commission = paymentAmount * 0.05; // 5% commission
      const previousBalance = selectedTenant.outstanding_balance || 0;
      const newBalance = Math.max(0, previousBalance - paymentAmount);

      // Get current manager info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      // Combine date and time into timestamp
      const dateTime = new Date(paymentDate);
      dateTime.setHours(parseInt(paymentTime.hours), parseInt(paymentTime.minutes), 0, 0);

      // Insert the collection record
      const { data: collectionData, error: collectionError } = await supabase
        .from("collections")
        .insert({
          tenant_id: selectedTenant.id,
          agent_id: selectedTenant.agent_id,
          amount: paymentAmount,
          commission: commission,
          payment_method: paymentMethod,
          payment_id: paymentId || null,
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
        .eq("id", selectedTenant.id);

      if (updateError) throw updateError;

      // Send notification to agent with payment receipt data
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          sender_id: user.id,
          recipient_id: selectedTenant.agents.user_id,
          title: "💰 Payment Recorded - Commission Earned!",
          message: `Manager ${managerProfile?.full_name || "Unknown"} recorded a payment of UGX ${paymentAmount.toLocaleString()} for tenant ${selectedTenant.tenant_name}. 

🎉 You earned UGX ${commission.toLocaleString()} commission (5%)!

Tenant Balance: UGX ${previousBalance.toLocaleString()} → UGX ${newBalance.toLocaleString()}

You can generate and share the receipt with your tenant from the payment notification.`,
          priority: "high",
          payment_data: {
            collection_id: collectionData.id,
            tenant_id: selectedTenant.id,
            tenant_name: selectedTenant.tenant_name,
            tenant_phone: selectedTenant.tenant_phone,
            amount: paymentAmount,
            payment_method: paymentMethod,
            payment_id: paymentId || undefined,
            payment_date: dateTime.toISOString(),
            previous_balance: previousBalance,
            new_balance: newBalance,
            commission: commission,
            recorded_by: "manager",
            manager_name: managerProfile?.full_name || "Unknown Manager",
          },
        });

      if (notificationError) {
        console.error("Error sending notification:", notificationError);
      }

      haptics.success(); // Success feedback
      toast({
        title: "Payment recorded",
        description: `Payment of UGX ${paymentAmount.toLocaleString()} recorded for ${selectedTenant.tenant_name}`,
      });

      // Reset form
      setSelectedTenant(null);
      setAmount("");
      setPaymentMethod("cash");
      setPaymentId("");
      setPaymentDate(new Date());
      setPaymentTime({ hours: new Date().getHours().toString().padStart(2, '0'), minutes: new Date().getMinutes().toString().padStart(2, '0') });
      onOpenChange(false);
    } catch (error) {
      console.error("Error recording payment:", error);
      haptics.error(); // Error feedback
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select Tenant</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedTenant ? selectedTenant.tenant_name : "Select tenant..."}
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
                          setSelectedTenant(tenant);
                          setSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{tenant.tenant_name}</span>
                          <span className="text-xs text-muted-foreground">
                            Agent: {tenant.agents.profiles.full_name} • Balance: UGX {tenant.outstanding_balance?.toLocaleString()}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedTenant && (
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding Balance:</span>
                <span className="font-semibold">UGX {selectedTenant.outstanding_balance?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Rent:</span>
                <span>UGX {selectedTenant.rent_amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent:</span>
                <span>{selectedTenant.agents.profiles.full_name}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount (UGX)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-id">Payment ID (Optional)</Label>
            <Input
              id="payment-id"
              type="text"
              placeholder="Enter payment reference ID"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method">
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
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => date && setPaymentDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Payment Time</Label>
            <div className="flex gap-2">
              <Select value={paymentTime.hours} onValueChange={(val) => setPaymentTime({ ...paymentTime, hours: val })}>
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
              <Select value={paymentTime.minutes} onValueChange={(val) => setPaymentTime({ ...paymentTime, minutes: val })}>
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

          {amount && selectedTenant && (
            <div className="rounded-lg bg-primary/10 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent Commission (5%):</span>
                <span className="font-semibold">UGX {(parseFloat(amount) * 0.05).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

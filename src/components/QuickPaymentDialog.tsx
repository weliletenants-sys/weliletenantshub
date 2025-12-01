import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Zap, CalendarIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { haptics } from "@/utils/haptics";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useOptimisticPayment } from "@/hooks/useOptimisticPayment";
import { format } from "date-fns";

interface Tenant {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  outstanding_balance: number;
  rent_amount: number;
}

interface QuickPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  tenant?: Tenant;
}

const QuickPaymentDialog = ({ open, onOpenChange, onSuccess, tenant: preselectedTenant }: QuickPaymentDialogProps) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentId, setPaymentId] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentTime, setPaymentTime] = useState({ hours: new Date().getHours().toString().padStart(2, '0'), minutes: new Date().getMinutes().toString().padStart(2, '0') });
  const [searchOpen, setSearchOpen] = useState(false);
  const [agentId, setAgentId] = useState<string>("");
  const [tidExists, setTidExists] = useState(false);
  const [checkingTid, setCheckingTid] = useState(false);
  
  // Optimistic mutation hook
  const paymentMutation = useOptimisticPayment();

  useEffect(() => {
    if (open) {
      fetchAgentAndTenants();
      // Pre-select tenant if provided
      if (preselectedTenant) {
        setSelectedTenant(preselectedTenant);
      }
      // Reset TID validation
      setTidExists(false);
      setCheckingTid(false);
    }
  }, [open, preselectedTenant]);

  // Real-time TID duplicate check with debouncing
  useEffect(() => {
    const checkTidDuplicate = async () => {
      if (!paymentId || paymentId.length < 3) {
        setTidExists(false);
        setCheckingTid(false);
        return;
      }

      setCheckingTid(true);
      
      try {
        const { data, error } = await supabase
          .from("collections")
          .select("id")
          .eq("payment_id", paymentId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error("Error checking TID:", error);
        }

        setTidExists(!!data);
      } catch (error) {
        console.error("Error checking TID:", error);
      } finally {
        setCheckingTid(false);
      }
    };

    // Debounce the check by 500ms
    const timeoutId = setTimeout(checkTidDuplicate, 500);
    return () => clearTimeout(timeoutId);
  }, [paymentId]);

  const fetchAgentAndTenants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get agent ID
      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (agent) {
        setAgentId(agent.id);

        // Fetch tenants
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('id, tenant_name, tenant_phone, outstanding_balance, rent_amount')
          .eq('agent_id', agent.id)
          .eq('status', 'verified')
          .order('tenant_name');

        setTenants(tenantsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error("Failed to load tenants");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.light(); // Form submission attempt
    
    if (!selectedTenant || !amount || !agentId || !paymentId) {
      haptics.error();
      toast.error("Please fill in all required fields including Transaction ID");
      return;
    }

    if (tidExists) {
      haptics.error();
      toast.error("This Transaction ID (TID) already exists. Please use a unique TID to avoid double entry.");
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      haptics.error(); // Validation error
      toast.error("Please enter a valid amount");
      return;
    }

    // Calculate commission (10%)
    const commission = paymentAmount * 0.1;

    // Combine date and time into timestamp
    const dateTime = new Date(paymentDate);
    dateTime.setHours(parseInt(paymentTime.hours), parseInt(paymentTime.minutes), 0, 0);

    // Use optimistic mutation - UI updates instantly
    paymentMutation.mutate({
      tenantId: selectedTenant.id,
      amount: paymentAmount,
      paymentMethod,
      collectionDate: dateTime.toISOString(),
      agentId,
      commission,
      paymentId: paymentId || undefined,
    }, {
      onSuccess: () => {
        haptics.success(); // Success feedback
        // Reset form on success
        setSelectedTenant(null);
        setAmount("");
        setPaymentMethod("cash");
        setPaymentId("");
        setPaymentDate(new Date());
        setPaymentTime({ hours: new Date().getHours().toString().padStart(2, '0'), minutes: new Date().getMinutes().toString().padStart(2, '0') });
        onOpenChange(false);
        onSuccess?.();
      },
      onError: () => {
        haptics.error(); // Error feedback
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Quick Payment Recording</DialogTitle>
          <DialogDescription>
            Select a tenant and record their payment instantly
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tenant Selector */}
          <div className="space-y-2">
            <Label>Select Tenant</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between",
                    !selectedTenant && "text-muted-foreground"
                  )}
                >
                  {selectedTenant ? selectedTenant.tenant_name : "Search tenant..."}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tenant by name or phone..." />
                  <CommandList>
                    <CommandEmpty>No tenant found.</CommandEmpty>
                    <CommandGroup>
                      {tenants.map((tenant) => (
                        <CommandItem
                          key={tenant.id}
                          value={`${tenant.tenant_name} ${tenant.tenant_phone}`}
                          onSelect={() => {
                            setSelectedTenant(tenant);
                            setSearchOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{tenant.tenant_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {tenant.tenant_phone} • Balance: UGX {tenant.outstanding_balance?.toLocaleString() || 0}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Tenant Details */}
          {selectedTenant && (
            <div className="bg-muted p-3 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Outstanding Balance:</span>
                <span className="font-bold">UGX {selectedTenant.outstanding_balance?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monthly Rent:</span>
                <span>UGX {selectedTenant.rent_amount?.toLocaleString() || 0}</span>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount (UGX)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="1"
              step="1"
            />
          </div>

          {/* Transaction ID */}
          <div className="space-y-2">
            <Label htmlFor="payment-id">Transaction ID (TID) *</Label>
            <div className="relative">
              <Input
                id="payment-id"
                type="text"
                placeholder="Enter unique transaction ID"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                required
                className={cn(
                  tidExists && "border-destructive focus-visible:ring-destructive",
                  checkingTid && "pr-10"
                )}
              />
              {checkingTid && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {tidExists && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-xs text-destructive font-medium">
                  This Transaction ID already exists in the system. Please use a different TID to avoid double entry.
                </p>
              </div>
            )}
            {!tidExists && paymentId && !checkingTid && (
              <div className="flex items-center gap-2 text-xs text-success">
                <CheckCircle2 className="h-3 w-3" />
                TID available
              </div>
            )}
            {!tidExists && (
              <p className="text-xs text-muted-foreground">Required to prevent double entry</p>
            )}
          </div>

          {/* Payment Method */}
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

          {/* Payment Date */}
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
              <PopoverContent className="w-auto p-0" align="start">
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

          {/* Payment Time */}
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

          {/* Commission Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-primary/10 p-3 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Commission (10%):</span>
                <span className="font-semibold text-primary">
                  UGX {(parseFloat(amount) * 0.1).toLocaleString()}
                </span>
              </div>
              {paymentMutation.isPending && (
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Zap className="h-3 w-3 animate-pulse" />
                  <span>Update will process instantly...</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={paymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={paymentMutation.isPending || !selectedTenant || !amount || !paymentId || tidExists || checkingTid}
            >
              {paymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Record Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickPaymentDialog;

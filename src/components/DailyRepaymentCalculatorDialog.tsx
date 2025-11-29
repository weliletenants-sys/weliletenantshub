import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calculator, Copy } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";

interface DailyRepaymentCalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DailyRepaymentCalculatorDialog = ({ open, onOpenChange }: DailyRepaymentCalculatorDialogProps) => {
  const [rentAmount, setRentAmount] = useState<string>("");
  const [period, setPeriod] = useState<string>("30");
  const [dailyAmount, setDailyAmount] = useState<number | null>(null);

  const calculateDailyRepayment = () => {
    const rent = parseFloat(rentAmount);
    if (isNaN(rent) || rent <= 0) {
      toast.error("Please enter a valid rent amount");
      return;
    }

    const days = parseInt(period);
    
    // Registration fee logic
    const registrationFee = rent <= 200000 ? 10000 : 20000;
    
    // Calculate base amount with registration
    let totalAmount = rent + registrationFee;
    
    // Apply 33% access fee that compounds every 30 days
    const periods = days / 30;
    for (let i = 0; i < periods; i++) {
      totalAmount = totalAmount * 1.33;
    }
    
    // Calculate daily repayment
    const daily = totalAmount / days;
    setDailyAmount(Math.round(daily));
    haptics.success();
  };

  const copyToWhatsApp = () => {
    if (dailyAmount) {
      const message = `💰 Welile Rent Payment Plan\n\nRent Amount: UGX ${parseFloat(rentAmount).toLocaleString()}\nPeriod: ${period} days\n\n✅ Customer pays only UGX ${dailyAmount.toLocaleString()} daily\n\n📞 Contact us for more details!`;
      
      if (navigator.share) {
        navigator.share({
          text: message
        }).catch(() => {
          navigator.clipboard.writeText(message);
          toast.success("Copied to clipboard!");
        });
      } else {
        navigator.clipboard.writeText(message);
        toast.success("Copied to clipboard!");
      }
      haptics.light();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calculator className="h-6 w-6 text-primary" />
            Daily Repayment Calculator
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="rent-amount">Rent Amount (UGX)</Label>
            <Input
              id="rent-amount"
              type="number"
              placeholder="e.g., 500000"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Payment Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="period" className="text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={calculateDailyRepayment} 
            className="w-full h-12 text-lg"
            size="lg"
          >
            Calculate Daily Payment
          </Button>

          {dailyAmount !== null && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-5">
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-8 text-center shadow-xl">
                <p className="text-sm font-medium mb-2 opacity-90">Customer pays only</p>
                <p className="text-5xl font-bold tracking-tight">
                  UGX {dailyAmount.toLocaleString()}
                </p>
                <p className="text-sm font-medium mt-2 opacity-90">daily</p>
              </div>

              <Button
                onClick={copyToWhatsApp}
                variant="outline"
                className="w-full h-12 gap-2"
                size="lg"
              >
                <Copy className="h-4 w-4" />
                Copy to WhatsApp
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";

interface CommissionCalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommissionCalculatorDialog = ({ open, onOpenChange }: CommissionCalculatorDialogProps) => {
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [commission, setCommission] = useState<number | null>(null);

  const calculateCommission = () => {
    const payment = parseFloat(paymentAmount);
    if (isNaN(payment) || payment <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    // Calculate 5% commission
    const comm = payment * 0.05;
    setCommission(Math.round(comm));
    haptics.success();
  };

  const resetCalculator = () => {
    setPaymentAmount("");
    setCommission(null);
  };

  // Quick calculation examples
  const quickExamples = [
    { amount: 50000, label: "50k" },
    { amount: 100000, label: "100k" },
    { amount: 200000, label: "200k" },
    { amount: 500000, label: "500k" },
  ];

  const handleQuickExample = (amount: number) => {
    setPaymentAmount(amount.toString());
    const comm = amount * 0.05;
    setCommission(Math.round(comm));
    haptics.light();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-6 w-6 text-primary" />
            Commission Calculator
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-center">
              <span className="font-semibold text-primary">You earn 5%</span> commission on every verified payment
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount (UGX)</Label>
            <Input
              id="payment-amount"
              type="number"
              placeholder="e.g., 100000"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="text-lg h-12"
            />
          </div>

          {/* Quick Examples */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Calculate:</Label>
            <div className="grid grid-cols-4 gap-2">
              {quickExamples.map((example) => (
                <Button
                  key={example.amount}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickExample(example.amount)}
                  className="text-xs"
                >
                  {example.label}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            onClick={calculateCommission} 
            className="w-full h-12 text-lg"
            size="lg"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Calculate Commission
          </Button>

          {commission !== null && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-5">
              {/* Payment Breakdown */}
              <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg p-6 space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-slate-300 dark:border-slate-600">
                  <span className="text-sm font-medium text-muted-foreground">Payment Amount</span>
                  <span className="text-lg font-semibold">
                    UGX {parseFloat(paymentAmount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Commission Rate</span>
                  <span className="text-lg font-semibold text-primary">5%</span>
                </div>
              </div>

              {/* Commission Result */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg p-8 text-center shadow-xl">
                <p className="text-sm font-medium mb-2 opacity-90 flex items-center justify-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  You Earn
                </p>
                <p className="text-5xl font-bold tracking-tight">
                  UGX {commission.toLocaleString()}
                </p>
                <p className="text-sm font-medium mt-2 opacity-90">commission</p>
              </div>

              {/* Example Calculations */}
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-primary mb-2">More Examples:</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">10 payments × UGX {parseFloat(paymentAmount).toLocaleString()}</span>
                    <span className="font-semibold">= UGX {(commission * 10).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">20 payments × UGX {parseFloat(paymentAmount).toLocaleString()}</span>
                    <span className="font-semibold">= UGX {(commission * 20).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">30 payments × UGX {parseFloat(paymentAmount).toLocaleString()}</span>
                    <span className="font-semibold text-success">= UGX {(commission * 30).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={resetCalculator}
                variant="outline"
                className="w-full h-12"
                size="lg"
              >
                Calculate Another
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

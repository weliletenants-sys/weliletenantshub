import { useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, Copy, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";

interface BulkResult {
  rent: number;
  day30: number;
  day60: number;
  day90: number;
}

const calculateDailyRate = (rent: number, days: number): number => {
  const registrationFee = rent <= 200000 ? 10000 : 20000;
  let totalAmount = rent + registrationFee;
  const periods = days / 30;
  for (let i = 0; i < periods; i++) {
    totalAmount = totalAmount * 1.33;
  }
  return Math.round(totalAmount / days);
};

const CalculatorPage = () => {
  // Single mode state
  const [rentAmount, setRentAmount] = useState<string>("");
  const [period, setPeriod] = useState<string>("30");
  const [dailyAmount, setDailyAmount] = useState<number | null>(null);

  // Bulk mode state
  const [bulkInput, setBulkInput] = useState<string>("");
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  const calculateDailyRepayment = () => {
    const rent = parseFloat(rentAmount);
    if (isNaN(rent) || rent <= 0) {
      toast.error("Please enter a valid rent amount");
      return;
    }

    if (rent > 50000000) {
      toast.error("Rent amount must be less than UGX 50,000,000");
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

  const calculateBulkRates = () => {
    if (!bulkInput.trim()) {
      toast.error("Please enter rent amounts");
      return;
    }

    // Split by commas, newlines, or spaces and clean up
    const inputs = bulkInput
      .split(/[,\n\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (inputs.length === 0) {
      toast.error("Please enter valid rent amounts");
      return;
    }

    if (inputs.length > 50) {
      toast.error("Maximum 50 rent amounts allowed at once");
      return;
    }

    const results: BulkResult[] = [];
    const invalid: string[] = [];

    inputs.forEach(input => {
      const rent = parseFloat(input);
      if (isNaN(rent) || rent <= 0) {
        invalid.push(input);
      } else if (rent > 50000000) {
        invalid.push(`${input} (too large)`);
      } else {
        results.push({
          rent,
          day30: calculateDailyRate(rent, 30),
          day60: calculateDailyRate(rent, 60),
          day90: calculateDailyRate(rent, 90),
        });
      }
    });

    if (invalid.length > 0) {
      toast.error(`Invalid amounts: ${invalid.join(", ")}`);
      return;
    }

    // Sort by rent amount
    results.sort((a, b) => a.rent - b.rent);
    setBulkResults(results);
    haptics.success();
    toast.success(`Calculated rates for ${results.length} amounts`);
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

  const copyBulkResults = () => {
    if (bulkResults.length === 0) return;

    let message = "💰 Welile Daily Repayment Rates\n\n";
    
    bulkResults.forEach(result => {
      message += `Rent: UGX ${result.rent.toLocaleString()}\n`;
      message += `• 30 days: ${result.day30.toLocaleString()}/day\n`;
      message += `• 60 days: ${result.day60.toLocaleString()}/day\n`;
      message += `• 90 days: ${result.day90.toLocaleString()}/day\n\n`;
    });

    message += "📞 Contact us for more details!";

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
  };

  return (
    <AgentLayout currentPage="/agent/calculator">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Calculator className="h-7 w-7 text-primary" />
              Daily Repayment Calculator
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="single" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="single" className="text-base">
                  <Calculator className="h-4 w-4 mr-2" />
                  Single
                </TabsTrigger>
                <TabsTrigger value="bulk" className="text-base">
                  <ListOrdered className="h-4 w-4 mr-2" />
                  Bulk Mode
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="rent-amount">Rent Amount (UGX)</Label>
                  <Input
                    id="rent-amount"
                    type="number"
                    placeholder="e.g., 500000"
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    className="text-lg h-12"
                    max={50000000}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period">Payment Period</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger id="period" className="text-lg h-12">
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
                  className="w-full h-14 text-lg"
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
                      className="w-full h-14 gap-2"
                      size="lg"
                    >
                      <Copy className="h-5 w-5" />
                      Copy to WhatsApp
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bulk" className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bulk-input">
                    Enter Multiple Rent Amounts
                    <span className="text-sm text-muted-foreground ml-2">
                      (comma-separated or one per line, max 50)
                    </span>
                  </Label>
                  <Textarea
                    id="bulk-input"
                    placeholder="e.g., 100000, 200000, 350000&#10;or one per line"
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value.slice(0, 2000))}
                    className="text-lg min-h-[120px] resize-none"
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate amounts with commas, spaces, or new lines. Maximum UGX 50,000,000 per amount.
                  </p>
                </div>

                <Button 
                  onClick={calculateBulkRates} 
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  <Calculator className="h-5 w-5 mr-2" />
                  Calculate All Rates
                </Button>

                {bulkResults.length > 0 && (
                  <div className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-5">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">
                        Calculated Rates ({bulkResults.length})
                      </h3>
                      <Button
                        onClick={copyBulkResults}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All
                      </Button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Rent Amount</th>
                            <th className="px-4 py-3 text-center font-semibold">30 Days</th>
                            <th className="px-4 py-3 text-center font-semibold">60 Days</th>
                            <th className="px-4 py-3 text-center font-semibold">90 Days</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {bulkResults.map((result, index) => (
                            <tr key={index} className="hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-3 font-medium">
                                UGX {result.rent.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                {result.day30.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                {result.day60.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                {result.day90.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Button
                      onClick={copyBulkResults}
                      variant="outline"
                      className="w-full h-14 gap-2"
                      size="lg"
                    >
                      <Copy className="h-5 w-5" />
                      Copy to WhatsApp
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default CalculatorPage;

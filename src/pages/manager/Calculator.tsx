import { useState, useEffect } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Calculator, Copy, ListOrdered, Save, FolderOpen, Trash2, FileDown, Settings, Printer } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

interface BulkResult {
  rent: number;
  day30: number;
  day60: number;
  day90: number;
}

interface SavedTemplate {
  id: string;
  name: string;
  amounts: string;
  createdAt: string;
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

const ManagerCalculatorPage = () => {
  // Single mode state
  const [rentAmount, setRentAmount] = useState<string>("");
  const [period, setPeriod] = useState<string>("30");
  const [dailyAmount, setDailyAmount] = useState<number | null>(null);

  // Bulk mode state
  const [bulkInput, setBulkInput] = useState<string>("");
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  // Template state
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // PDF customization state
  const [pdfSettingsOpen, setPdfSettingsOpen] = useState(false);
  const [pdfName, setPdfName] = useState("");
  const [pdfHeader, setPdfHeader] = useState("");
  const [pdfFooter, setPdfFooter] = useState("");

  // Load saved templates and PDF settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("calculator-templates-manager");
    if (saved) {
      try {
        setSavedTemplates(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load templates:", e);
      }
    }

    const pdfSettings = localStorage.getItem("pdf-settings-manager");
    if (pdfSettings) {
      try {
        const settings = JSON.parse(pdfSettings);
        setPdfName(settings.name || "");
        setPdfHeader(settings.header || "");
        setPdfFooter(settings.footer || "");
      } catch (e) {
        console.error("Failed to load PDF settings:", e);
      }
    }
  }, []);

  // Load user profile for default name
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !pdfName) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (profile?.full_name) {
          setPdfName(profile.full_name);
        }
      }
    };
    loadProfile();
  }, []);

  // Save templates to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("calculator-templates-manager", JSON.stringify(savedTemplates));
  }, [savedTemplates]);

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

  const saveAsTemplate = () => {
    if (!bulkInput.trim()) {
      toast.error("Please enter rent amounts before saving");
      return;
    }

    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (templateName.length > 50) {
      toast.error("Template name must be less than 50 characters");
      return;
    }

    if (savedTemplates.length >= 20) {
      toast.error("Maximum 20 templates allowed. Delete some to add new ones.");
      return;
    }

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      amounts: bulkInput.trim(),
      createdAt: new Date().toISOString(),
    };

    setSavedTemplates([...savedTemplates, newTemplate]);
    setTemplateName("");
    setSaveDialogOpen(false);
    toast.success(`Template "${newTemplate.name}" saved!`);
    haptics.success();
  };

  const loadTemplate = (template: SavedTemplate) => {
    setBulkInput(template.amounts);
    setLoadDialogOpen(false);
    toast.success(`Template "${template.name}" loaded!`);
    haptics.light();
  };

  const deleteTemplate = (id: string) => {
    const template = savedTemplates.find(t => t.id === id);
    setSavedTemplates(savedTemplates.filter(t => t.id !== id));
    toast.success(`Template "${template?.name}" deleted`);
    haptics.light();
  };

  const savePdfSettings = () => {
    const settings = {
      name: pdfName,
      header: pdfHeader,
      footer: pdfFooter,
    };
    localStorage.setItem("pdf-settings-manager", JSON.stringify(settings));
    setPdfSettingsOpen(false);
    toast.success("PDF settings saved!");
    haptics.success();
  };

  const generatePDF = () => {
    if (bulkResults.length === 0) return null;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Helper function to add purple header with logo
    const addPurpleHeader = () => {
      // Purple background header
      doc.setFillColor(107, 45, 197); // Purple #6B2DC5
      doc.rect(0, 0, pageWidth, 50, 'F');
      
      // Load and add Welile logo on purple background
      const img = new Image();
      img.src = '/welile-logo-pdf.jpg';
      doc.addImage(img, 'JPEG', 15, 5, 40, 40);
      
      // Custom header text on purple background if provided
      if (pdfHeader) {
        doc.setTextColor(255, 255, 255); // White text on purple
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(pdfHeader, 60, 25);
      }
    };
    
    // Helper function to add footer to a page
    const addFooter = (pageNum: number, totalPages: number) => {
      if (pdfFooter) {
        doc.setFontSize(8);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(100, 100, 100);
        
        // Split footer text into lines if too long
        const footerLines = doc.splitTextToSize(pdfFooter, pageWidth - 30);
        const footerStartY = pageHeight - 15 - (footerLines.length * 3);
        
        footerLines.forEach((line: string, index: number) => {
          doc.text(line, 15, footerStartY + (index * 3));
        });
        
        // Page number
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 30, pageHeight - 10);
      }
    };
    
    // Calculate total pages needed
    const itemsPerPage = Math.floor((pageHeight - 110) / 8);
    const totalPages = Math.ceil(bulkResults.length / itemsPerPage);
    
    // Add purple header with logo to first page
    addPurpleHeader();
    
    // Title below purple header
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text("Daily Repayment Rates - Bulk Calculation", 15, 65);
    
    // Manager name and date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    if (pdfName) {
      doc.text(`Prepared by: ${pdfName}`, 15, 73);
    }
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, 79);
    
    // Table headers
    let yPos = 90;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("Rent Amount", 15, yPos);
    doc.text("30 Days", 70, yPos);
    doc.text("60 Days", 110, yPos);
    doc.text("90 Days", 150, yPos);
    
    // Table data
    doc.setFont(undefined, 'normal');
    yPos += 8;
    
    let currentPage = 1;
    const maxYPos = pdfFooter ? pageHeight - 25 : pageHeight - 15;
    
    bulkResults.forEach((result, index) => {
      if (yPos > maxYPos) {
        // Add footer to current page before adding new page
        addFooter(currentPage, totalPages);
        
        doc.addPage();
        currentPage++;
        
        // Add purple header with logo on new pages
        addPurpleHeader();
        yPos = 65;
        
        // Re-add table headers on new page
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text("Rent Amount", 15, yPos);
        doc.text("30 Days", 70, yPos);
        doc.text("60 Days", 110, yPos);
        doc.text("90 Days", 150, yPos);
        yPos += 8;
        doc.setFont(undefined, 'normal');
      }
      
      doc.text(`UGX ${result.rent.toLocaleString()}`, 15, yPos);
      doc.text(result.day30.toLocaleString(), 70, yPos);
      doc.text(result.day60.toLocaleString(), 110, yPos);
      doc.text(result.day90.toLocaleString(), 150, yPos);
      yPos += 8;
    });
    
    // Add footer to last page
    addFooter(currentPage, totalPages);
    
    return doc;
  };

  const downloadBulkPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    
    doc.save(`welile-bulk-rates-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF downloaded successfully!");
    haptics.success();
  };

  const printBulkPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    
    // Open PDF in new window for printing
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    toast.success("Opening print dialog...");
    haptics.light();
  };

  return (
    <ManagerLayout currentPage="/manager/calculator">
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
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="bulk-input">
                      Enter Multiple Rent Amounts
                      <span className="text-sm text-muted-foreground ml-2">
                        (comma-separated or one per line, max 50)
                      </span>
                    </Label>
                    <div className="flex gap-2">
                      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <FolderOpen className="h-4 w-4 mr-2" />
                            Load Template
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Load Saved Template</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {savedTemplates.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No saved templates yet. Save your first template to reuse rent amount sets.
                              </p>
                            ) : (
                              savedTemplates.map((template) => (
                                <div
                                  key={template.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{template.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(template.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 ml-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => loadTemplate(template)}
                                    >
                                      Load
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteTemplate(template.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Save className="h-4 w-4 mr-2" />
                            Save Template
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save as Template</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="template-name">Template Name</Label>
                              <Input
                                id="template-name"
                                placeholder="e.g., Standard Properties"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value.slice(0, 50))}
                                maxLength={50}
                              />
                              <p className="text-xs text-muted-foreground">
                                Give your template a descriptive name for easy identification
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={saveAsTemplate} className="w-full">
                              <Save className="h-4 w-4 mr-2" />
                              Save Template
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
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
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <h3 className="text-lg font-semibold">
                        Calculated Rates ({bulkResults.length})
                      </h3>
                      <div className="flex gap-2 flex-wrap">
                        <Dialog open={pdfSettingsOpen} onOpenChange={setPdfSettingsOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Settings className="h-4 w-4 mr-2" />
                              PDF Settings
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Customize PDF Template</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="pdf-name">Your Name</Label>
                                <Input
                                  id="pdf-name"
                                  placeholder="e.g., John Doe"
                                  value={pdfName}
                                  onChange={(e) => setPdfName(e.target.value)}
                                  maxLength={100}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Will appear as "Prepared by" on the PDF
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="pdf-header">Custom Header (Optional)</Label>
                                <Input
                                  id="pdf-header"
                                  placeholder="e.g., Premium Properties Division"
                                  value={pdfHeader}
                                  onChange={(e) => setPdfHeader(e.target.value)}
                                  maxLength={100}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Additional header text to display on PDF
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="pdf-footer">Footer Text (Optional)</Label>
                                <Textarea
                                  id="pdf-footer"
                                  placeholder="e.g., Terms & Conditions apply. Contact: +256 XXX XXX XXX"
                                  value={pdfFooter}
                                  onChange={(e) => setPdfFooter(e.target.value.slice(0, 250))}
                                  className="resize-none min-h-[80px]"
                                  maxLength={250}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Footer text for terms, conditions, or contact info (max 250 characters)
                                </p>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={savePdfSettings} className="w-full">
                                <Save className="h-4 w-4 mr-2" />
                                Save Settings
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          onClick={downloadBulkPDF}
                          variant="outline"
                          size="sm"
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button
                          onClick={printBulkPDF}
                          variant="outline"
                          size="sm"
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Print PDF
                        </Button>
                        <Button
                          onClick={copyBulkResults}
                          variant="outline"
                          size="sm"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy All
                        </Button>
                      </div>
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
    </ManagerLayout>
  );
};

export default ManagerCalculatorPage;

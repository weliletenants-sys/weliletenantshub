import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Printer, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import ManagerLayout from "@/components/ManagerLayout";

// Default data for the rates table
const defaultRatesData = [
  { rent: 100000, d30: 4367, d60: 5283, d90: 6333 },
  { rent: 150000, d30: 6500, d60: 7950, d90: 9500 },
  { rent: 200000, d30: 8633, d60: 10633, d90: 12767 },
  { rent: 300000, d30: 13933, d60: 17433, d90: 21100 },
  { rent: 400000, d30: 18600, d60: 23333, d90: 28333 },
  { rent: 500000, d30: 23267, d60: 29233, d90: 35567 },
  { rent: 600000, d30: 27933, d60: 35133, d90: 42800 },
  { rent: 800000, d30: 37267, d60: 46933, d90: 57267 },
  { rent: 1000000, d30: 46600, d60: 58733, d90: 71733 },
];

const calculateDailyRate = (rent: number, days: number): number => {
  const registrationFee = rent <= 200000 ? 10000 : 20000;
  let totalAmount = rent + registrationFee;
  const periods = days / 30;
  for (let i = 0; i < periods; i++) {
    totalAmount = totalAmount * 1.33;
  }
  return Math.round(totalAmount / days);
};

const PrintableDailyRates = () => {
  const [ratesData, setRatesData] = useState(() => {
    const saved = localStorage.getItem("printable-rates-manager");
    return saved ? JSON.parse(saved) : defaultRatesData;
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editRent, setEditRent] = useState("");

  useEffect(() => {
    localStorage.setItem("printable-rates-manager", JSON.stringify(ratesData));
  }, [ratesData]);

  const handleAddRow = () => {
    const rent = parseFloat(editRent);
    if (isNaN(rent) || rent <= 0) {
      toast.error("Please enter a valid rent amount");
      return;
    }
    
    const newRow = {
      rent,
      d30: calculateDailyRate(rent, 30),
      d60: calculateDailyRate(rent, 60),
      d90: calculateDailyRate(rent, 90),
    };
    
    setRatesData([...ratesData, newRow].sort((a, b) => a.rent - b.rent));
    setEditRent("");
    setEditDialogOpen(false);
    toast.success("Row added successfully");
  };

  const handleEditRow = (index: number) => {
    setEditingIndex(index);
    setEditRent(ratesData[index].rent.toString());
    setEditDialogOpen(true);
  };

  const handleUpdateRow = () => {
    if (editingIndex === null) return;
    
    const rent = parseFloat(editRent);
    if (isNaN(rent) || rent <= 0) {
      toast.error("Please enter a valid rent amount");
      return;
    }
    
    const updatedData = [...ratesData];
    updatedData[editingIndex] = {
      rent,
      d30: calculateDailyRate(rent, 30),
      d60: calculateDailyRate(rent, 60),
      d90: calculateDailyRate(rent, 90),
    };
    
    setRatesData(updatedData.sort((a, b) => a.rent - b.rent));
    setEditingIndex(null);
    setEditRent("");
    setEditDialogOpen(false);
    toast.success("Row updated successfully");
  };

  const handleDeleteRow = (index: number) => {
    const updatedData = ratesData.filter((_, i) => i !== index);
    setRatesData(updatedData);
    toast.success("Row deleted successfully");
  };

  const handleResetToDefaults = () => {
    setRatesData(defaultRatesData);
    toast.success("Reset to default rates");
  };

  const handlePrint = () => {
    window.print();
    toast.success("Print dialog opened");
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Add logo/header
    doc.setFillColor(107, 45, 197); // #6B2DC5
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("Welile", 15, 20);
    
    // Add date
    doc.setFontSize(10);
    doc.text(format(new Date(), 'PPP'), pageWidth - 15, 20, { align: 'right' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Add title
    doc.setFontSize(16);
    doc.text("Daily Repayment Rates Quick Reference", 15, 45);
    
    // Add table headers
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("Rent Amount", 15, 60);
    doc.text("30 Days", 80, 60);
    doc.text("60 Days", 120, 60);
    doc.text("90 Days", 160, 60);
    
    // Add line under headers
    doc.setLineWidth(0.5);
    doc.line(15, 63, pageWidth - 15, 63);
    
    // Add data rows
    doc.setFont(undefined, 'normal');
    let yPos = 73;
    
    ratesData.forEach((row) => {
      doc.text(`UGX ${row.rent.toLocaleString()}`, 15, yPos);
      doc.text(`${row.d30.toLocaleString()}`, 80, yPos);
      doc.text(`${row.d60.toLocaleString()}`, 120, yPos);
      doc.text(`${row.d90.toLocaleString()}`, 160, yPos);
      yPos += 10;
    });
    
    // Add footer
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("All rates shown are daily installment amounts in UGX", 15, yPos + 10);
    doc.text("Generated by Welile Agent Pro", 15, yPos + 16);
    
    doc.save(`Welile-Daily-Rates-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success("PDF downloaded successfully!");
  };

  return (
    <ManagerLayout currentPage="/manager/printable-rates">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="print:hidden space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Printable Daily Rates</h1>
              <p className="text-muted-foreground">Quick reference for agent training and customer consultations</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button onClick={handleDownloadPDF} size="lg" className="flex-1 min-w-[200px]">
              <Download className="mr-2 h-5 w-5" />
              Download PDF
            </Button>
            <Button onClick={handlePrint} variant="outline" size="lg" className="flex-1 min-w-[200px]">
              <Printer className="mr-2 h-5 w-5" />
              Print
            </Button>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="lg" 
                  className="flex-1 min-w-[200px]"
                  onClick={() => {
                    setEditingIndex(null);
                    setEditRent("");
                  }}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add Custom Amount
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingIndex !== null ? "Edit" : "Add"} Rent Amount</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rent Amount (UGX)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 750000"
                      value={editRent}
                      onChange={(e) => setEditRent(e.target.value)}
                      className="text-lg"
                    />
                  </div>
                  <Button 
                    onClick={editingIndex !== null ? handleUpdateRow : handleAddRow}
                    className="w-full"
                  >
                    {editingIndex !== null ? "Update" : "Add"} Row
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              onClick={handleResetToDefaults} 
              variant="ghost" 
              size="lg"
              className="flex-1 min-w-[200px]"
            >
              Reset to Defaults
            </Button>
          </div>
        </div>

        <Card className="printable-content">
          <div className="p-8 space-y-6">
            <div className="bg-primary px-8 py-4 rounded-lg inline-block print:mb-4">
              <h1 className="font-chewy text-4xl text-primary-foreground">Welile</h1>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Daily Repayment Rates</h2>
              <p className="text-muted-foreground">Generated on {format(new Date(), 'PPP')}</p>
            </div>

            <div className="overflow-hidden border rounded-lg">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Rent Amount</th>
                    <th className="px-6 py-4 text-center font-semibold">30 Days</th>
                    <th className="px-6 py-4 text-center font-semibold">60 Days</th>
                    <th className="px-6 py-4 text-center font-semibold">90 Days</th>
                    <th className="px-6 py-4 text-center font-semibold no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ratesData.map((row, index) => (
                    <tr key={row.rent} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        UGX {row.rent.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center font-mono">
                        {row.d30.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center font-mono">
                        {row.d60.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center font-mono">
                        {row.d90.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center no-print">
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRow(index)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRow(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-sm text-muted-foreground space-y-1 pt-4 border-t">
              <p>📌 All rates shown are daily installment amounts in UGX</p>
              <p>📌 Includes registration fee and 33% access fee</p>
              <p className="print:block hidden">Generated by Welile Agent Pro • {format(new Date(), 'PPP')}</p>
            </div>
          </div>
        </Card>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          th:last-child, td:last-child {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          .printable-content, .printable-content * {
            visibility: visible;
          }
          .printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </ManagerLayout>
  );
};

export default PrintableDailyRates;

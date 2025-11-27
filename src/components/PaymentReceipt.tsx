import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { format } from "date-fns";

interface PaymentReceiptProps {
  paymentData: {
    amount: number;
    commission: number;
    collectionDate: string;
    paymentMethod: string;
  };
  tenantData: {
    tenant_name: string;
    tenant_phone: string;
    rent_amount: number;
    outstanding_balance: number;
  };
  agentData: {
    agent_name: string;
    agent_phone: string;
  };
  receiptNumber: string;
}

const PaymentReceipt = ({ paymentData, tenantData, agentData, receiptNumber }: PaymentReceiptProps) => {
  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const message = `
🧾 *PAYMENT RECEIPT*
━━━━━━━━━━━━━━━━━

📋 Receipt No: ${receiptNumber}
📅 Date: ${format(new Date(paymentData.collectionDate), "MMM dd, yyyy")}

👤 *TENANT DETAILS*
Name: ${tenantData.tenant_name}
Phone: ${tenantData.tenant_phone}

💰 *PAYMENT DETAILS*
Amount Paid: UGX ${paymentData.amount.toLocaleString()}
Payment Method: ${paymentData.paymentMethod.replace("_", " ").toUpperCase()}
Monthly Rent: UGX ${tenantData.rent_amount.toLocaleString()}

📊 *BALANCE INFORMATION*
Previous Balance: UGX ${(tenantData.outstanding_balance + paymentData.amount).toLocaleString()}
Amount Paid: UGX ${paymentData.amount.toLocaleString()}
*Current Balance: UGX ${tenantData.outstanding_balance.toLocaleString()}*

👨‍💼 *AGENT*
${agentData.agent_name}
${agentData.agent_phone}

━━━━━━━━━━━━━━━━━
✅ Payment Confirmed
Thank you for your payment!
    `.trim();

    const whatsappUrl = `https://wa.me/${tenantData.tenant_phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <Card className="print:shadow-none" id="receipt">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-2xl font-bold text-primary">PAYMENT RECEIPT</h1>
            <p className="text-sm text-muted-foreground mt-1">Welile Tenant Hub</p>
          </div>

          {/* Receipt Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Receipt No.</p>
              <p className="font-semibold">{receiptNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Date</p>
              <p className="font-semibold">
                {format(new Date(paymentData.collectionDate), "MMM dd, yyyy")}
              </p>
            </div>
          </div>

          {/* Tenant Details */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Tenant Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{tenantData.tenant_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{tenantData.tenant_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Rent:</span>
                <span className="font-medium">UGX {tenantData.rent_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Payment Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-bold text-lg">UGX {paymentData.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="font-medium capitalize">
                  {paymentData.paymentMethod.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>

          {/* Balance Information */}
          <div className="border-t pt-4 bg-muted/30 -mx-6 px-6 py-4">
            <h3 className="font-semibold mb-3">Balance Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous Balance:</span>
                <span className="font-medium">
                  UGX {(tenantData.outstanding_balance + paymentData.amount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-medium text-success">
                  - UGX {paymentData.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="font-semibold">Current Balance:</span>
                <span className="font-bold text-lg text-primary">
                  UGX {tenantData.outstanding_balance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Agent Details */}
          <div className="border-t pt-4 text-sm">
            <h3 className="font-semibold mb-2">Collected By</h3>
            <p className="font-medium">{agentData.agent_name}</p>
            <p className="text-muted-foreground">{agentData.agent_phone}</p>
          </div>

          {/* Footer */}
          <div className="border-t pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              This is an official payment receipt from Welile Tenant Hub
            </p>
            <p className="text-xs text-success font-medium mt-1">✓ Payment Confirmed</p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 print:hidden">
        <Button onClick={handlePrint} variant="outline" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download/Print
        </Button>
        <Button onClick={handleWhatsAppShare} className="flex-1 bg-green-600 hover:bg-green-700">
          <Share2 className="h-4 w-4 mr-2" />
          Share on WhatsApp
        </Button>
      </div>
    </div>
  );
};

export default PaymentReceipt;

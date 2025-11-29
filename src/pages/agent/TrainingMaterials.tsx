import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import AgentLayout from "@/components/AgentLayout";
import { Calculator, DollarSign, MessageSquare, TrendingUp, Users, FileText, BookOpen, Lightbulb, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const TrainingMaterials = () => {
  const navigate = useNavigate();

  return (
    <AgentLayout currentPage="training">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Training Materials
          </h1>
          <p className="text-muted-foreground">Learn how to use Welile tools and close more deals</p>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate("/agent/dashboard")}
          >
            <CardContent className="p-6">
              <Calculator className="h-10 w-10 text-purple-600 mb-3" />
              <h3 className="font-semibold text-lg mb-2">Daily Repayment Calculator</h3>
              <p className="text-sm text-muted-foreground">Learn to calculate and present payment plans</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate("/agent/printable-rates")}
          >
            <CardContent className="p-6">
              <FileText className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Printable Rate Tables</h3>
              <p className="text-sm text-muted-foreground">View and share quick reference rates</p>
            </CardContent>
          </Card>
        </div>

        {/* Training Content */}
        <Card>
          <CardHeader>
            <CardTitle>Complete Training Guide</CardTitle>
            <CardDescription>Everything you need to know to succeed as a Welile agent</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              
              {/* Calculator Training */}
              <AccordionItem value="calculator">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-purple-600" />
                    How to Use the Daily Repayment Calculator
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Step-by-Step Guide
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 ml-6 text-sm">
                      <li>Open the calculator from your dashboard (purple button)</li>
                      <li>Ask the customer: "How much rent do you need to pay?"</li>
                      <li>Enter the amount in the Rent Amount field</li>
                      <li>Ask: "How long do you need to pay it back?" (30, 60, or 90 days)</li>
                      <li>Select the payment period from the dropdown</li>
                      <li>Press "Calculate Daily Payment"</li>
                      <li>Show the customer the big green number - this is what they pay EVERY day</li>
                      <li>Use "Copy to WhatsApp" to share the payment plan with them</li>
                    </ol>

                    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
                      <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4" />
                        Pro Tip: Present It Right
                      </h5>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Always say "You only pay UGX X,XXX per day" - the word "only" makes it feel affordable. Never mention the total amount with interest upfront!
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* How Calculations Work */}
              <AccordionItem value="how-it-works">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Understanding How Welile Rates Work
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Registration Fee</h4>
                      <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                        <li>Rent ≤ UGX 200,000 → UGX 10,000 registration fee</li>
                        <li>Rent ≥ UGX 200,001 → UGX 20,000 registration fee</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Access Fee (Interest)</h4>
                      <p className="text-sm mb-2">33% per 30-day period, compounded</p>
                      <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                        <li>30 days → 33% access fee on total (rent + registration)</li>
                        <li>60 days → 33% compounds twice (total ~77% effective rate)</li>
                        <li>90 days → 33% compounds three times (total ~135% effective rate)</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Example Calculation</h4>
                      <div className="bg-muted rounded-lg p-4 text-sm space-y-2 font-mono">
                        <p>Customer needs UGX 500,000 for 30 days:</p>
                        <p className="ml-4">• Rent amount: 500,000</p>
                        <p className="ml-4">• Registration fee: +20,000 (≥200,001)</p>
                        <p className="ml-4">• Subtotal: 520,000</p>
                        <p className="ml-4">• Access fee 33%: × 1.33</p>
                        <p className="ml-4">• Total to repay: 691,600</p>
                        <p className="ml-4">• Daily payment: 691,600 ÷ 30 = <span className="text-green-600 font-bold">23,053</span></p>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Why This Works:</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Breaking payments into daily installments makes large amounts feel manageable. UGX 23,053 per day sounds much easier than UGX 691,600 total!
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Rate Tables */}
              <AccordionItem value="rate-tables">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Using Printable Rate Tables
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <p className="text-sm">The printable rate tables show the most common rent amounts and their daily payments at a glance.</p>
                    
                    <h4 className="font-semibold mt-4">When to Use Rate Tables:</h4>
                    <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                      <li>Quick reference during customer conversations</li>
                      <li>Print and carry with you when visiting tenants</li>
                      <li>Share PDF via WhatsApp for customer reference</li>
                      <li>Training new team members on pricing structure</li>
                    </ul>

                    <h4 className="font-semibold mt-4">How to Access:</h4>
                    <ol className="list-decimal list-inside space-y-2 ml-6 text-sm">
                      <li>Tap "More" menu in bottom navigation</li>
                      <li>Select "Printable Rates"</li>
                      <li>View the complete rate table on screen</li>
                      <li>Download PDF or Print directly</li>
                    </ol>

                    <Button 
                      className="w-full mt-4"
                      onClick={() => navigate("/agent/printable-rates")}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Rate Tables Now
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Customer Conversations */}
              <AccordionItem value="conversations">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-orange-600" />
                    How to Talk to Customers About Payments
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Do Say:
                      </h4>
                      <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
                        <li>✅ "You only pay UGX 23,000 per day"</li>
                        <li>✅ "That is like 2 chapatis per day to secure your rent"</li>
                        <li>✅ "Many customers choose 30 days because the daily amount is lower"</li>
                        <li>✅ "We help you break down big rent into small daily payments"</li>
                        <li>✅ "You can pay cash, MTN, or Airtel - whatever is easiest"</li>
                      </ul>
                    </div>

                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Don&apos;t Say:
                      </h4>
                      <ul className="space-y-2 text-sm text-red-700 dark:text-red-300">
                        <li>❌ "The interest is 33%"</li>
                        <li>❌ "You will pay UGX 691,600 total"</li>
                        <li>❌ "This is expensive but..."</li>
                        <li>❌ "The company charges high fees"</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Sample Conversation Script</h4>
                      <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                        <p className="font-semibold">Agent: "How much is your rent?"</p>
                        <p className="text-muted-foreground">Customer: "500,000 shillings"</p>
                        <p className="font-semibold">Agent: "When do you need to pay it?"</p>
                        <p className="text-muted-foreground">Customer: "Next month"</p>
                        <p className="font-semibold">Agent: "Perfect! With Welile, you only pay UGX 23,000 per day for 30 days. That is like buying 2 chapatis daily to secure your home. Shall we register you now?"</p>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* WhatsApp Tips */}
              <AccordionItem value="whatsapp">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                    WhatsApp Sharing Best Practices
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <p className="text-sm">The calculator has a "Copy to WhatsApp" button that creates a professional message you can share.</p>

                    <h4 className="font-semibold mt-4">What Gets Copied:</h4>
                    <div className="bg-muted rounded-lg p-4 text-sm font-mono">
                      <p>💰 Welile Rent Payment Plan</p>
                      <p className="mt-2">Rent Amount: UGX 500,000</p>
                      <p>Period: 30 days</p>
                      <p className="mt-2">✅ Customer pays only UGX 23,267 daily</p>
                      <p className="mt-2">📞 Contact us for more details!</p>
                    </div>

                    <h4 className="font-semibold mt-4">Best Practices:</h4>
                    <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                      <li>Always follow up the copied message with a voice note explaining benefits</li>
                      <li>Send a personal message before the payment plan to build trust</li>
                      <li>Offer to meet in person to answer questions</li>
                      <li>Share rate tables PDF for customers who want to see all options</li>
                      <li>Respond quickly to questions - fast replies convert to tenants!</li>
                    </ul>

                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                      <h5 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4" />
                        Pro Tip: Follow-Up Messages
                      </h5>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        After sharing the payment plan, send: "This means you can secure your home for just the price of breakfast each day 😊 When would you like to start?"
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Commission & Earnings */}
              <AccordionItem value="earnings">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Your Commissions & Motorcycle Reward
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">How You Earn</h4>
                      <p className="text-sm mb-3">You earn commission on every verified payment collected from your tenants.</p>
                      <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                        <li>Record payments in the app immediately after collection</li>
                        <li>Manager verifies your payments within 24-48 hours</li>
                        <li>Verified payments add to your monthly commission total</li>
                        <li>Check your Earnings page to track commission</li>
                      </ul>
                    </div>

                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Motorcycle Reward Program
                      </h4>
                      <p className="text-sm mb-3">Reach 50 active paying tenants and qualify for your free motorcycle!</p>
                      <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                        <li>Motorcycle provided on 0% interest pay-as-you-go plan</li>
                        <li>UGX 80,000/month deducted from your commissions automatically</li>
                        <li>Track your progress on the dashboard</li>
                        <li>Build your portfolio faster with motorcycle mobility</li>
                      </ul>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Quick Math:</h5>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        More tenants = More daily collections = Higher commission = Faster motorcycle qualification. Focus on growing your tenant base every single day!
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="text-lg">Need More Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate("/agent/ai-assistant")}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask the AI Assistant
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate("/agent/dashboard")}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
};

export default TrainingMaterials;

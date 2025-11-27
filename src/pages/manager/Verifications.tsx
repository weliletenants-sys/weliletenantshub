import ManagerLayout from "@/components/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Phone, MapPin } from "lucide-react";

const ManagerVerifications = () => {
  // Mock data - would be fetched from database
  const pendingVerifications = [
    {
      id: 1,
      tenantName: "Alice Johnson",
      landlordName: "Robert Smith",
      landlordPhone: "0700111222",
      lc1Name: "LC1 Chairman John",
      lc1Phone: "0700333444",
      location: "Kampala, Nakawa",
      rentAmount: 350000,
      submittedBy: "John Agent",
    },
    {
      id: 2,
      tenantName: "David Brown",
      landlordName: "Mary Wilson",
      landlordPhone: "0700555666",
      lc1Name: "LC1 Secretary Jane",
      lc1Phone: "0700777888",
      location: "Kampala, Makindye",
      rentAmount: 280000,
      submittedBy: "Sarah Agent",
    },
  ];

  return (
    <ManagerLayout currentPage="/manager/verifications">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Landlord Verifications</h1>
          <p className="text-muted-foreground">Review and approve pending verifications</p>
        </div>

        {pendingVerifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">No pending verifications at the moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingVerifications.map((verification) => (
              <Card key={verification.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{verification.tenantName}</CardTitle>
                      <CardDescription>Submitted by {verification.submittedBy}</CardDescription>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Landlord</p>
                        <p className="font-medium">{verification.landlordName}</p>
                        <p className="text-sm flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {verification.landlordPhone}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">LC1 Official</p>
                        <p className="font-medium">{verification.lc1Name}</p>
                        <p className="text-sm flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {verification.lc1Phone}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Location</p>
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {verification.location}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Monthly Rent</p>
                        <p className="font-bold text-lg">
                          UGX {verification.rentAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button variant="default" className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve & Verify
                    </Button>
                    <Button variant="destructive" className="flex-1">
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button variant="outline">
                      <Phone className="h-4 w-4 mr-2" />
                      Call Landlord
                    </Button>
                    <Button variant="outline">
                      <Phone className="h-4 w-4 mr-2" />
                      Call LC1
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
};

export default ManagerVerifications;

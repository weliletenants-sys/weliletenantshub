import { useEffect, useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { initOfflineDB } from "@/lib/offlineSync";
import { CloudOff, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface PendingItem {
  id: string;
  data: any;
  timestamp: number;
  synced: boolean;
  type: 'tenant' | 'collection';
}

const OfflineQueue = () => {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  useEffect(() => {
    loadPendingItems();
  }, []);

  const loadPendingItems = async () => {
    const db = await initOfflineDB();
    const tenants = await db.getAll('pendingTenants');
    const collections = await db.getAll('pendingCollections');

    const allItems: PendingItem[] = [
      ...tenants.map(t => ({ ...t, type: 'tenant' as const })),
      ...collections.map(c => ({ ...c, type: 'collection' as const })),
    ].sort((a, b) => b.timestamp - a.timestamp);

    setPendingItems(allItems);
  };

  const deleteItem = async (id: string, type: 'tenant' | 'collection') => {
    const db = await initOfflineDB();
    if (type === 'tenant') {
      await db.delete('pendingTenants', id);
    } else {
      await db.delete('pendingCollections', id);
    }
    await loadPendingItems();
  };

  return (
    <AgentLayout currentPage="/agent/offline-queue">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Offline Queue</h1>
          <p className="text-muted-foreground">
            Data saved while offline, waiting to sync
          </p>
        </div>

        {pendingItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CloudOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending items</h3>
              <p className="text-muted-foreground">
                All your data has been synced to the cloud
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingItems.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {item.type === 'tenant' 
                          ? item.data.tenant_name 
                          : `Collection - UGX ${item.data.amount?.toLocaleString()}`}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(item.timestamp, 'MMM dd, yyyy HH:mm')}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.synced ? "default" : "secondary"}>
                        {item.synced ? "Synced" : "Pending"}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {item.type}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.type === 'tenant' && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Rent Amount</p>
                        <p className="font-medium">
                          UGX {item.data.rent_amount?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Landlord</p>
                        <p className="font-medium">{item.data.landlord_name}</p>
                      </div>
                    </div>
                  )}
                  
                  {!item.synced && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteItem(item.id, item.type)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AgentLayout>
  );
};

export default OfflineQueue;

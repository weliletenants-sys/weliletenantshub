import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Building2, 
  CheckCircle, 
  Clock, 
  Search, 
  Filter,
  Eye,
  EyeOff,
  MapPin,
  User,
  Calendar
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { haptics } from "@/utils/haptics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LandlordNotification {
  id: string;
  landlord_name: string;
  landlord_phone: string;
  properties: string | null;
  village_cell_location: string | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  registered_by: string;
  agent_name: string;
  agent_phone: string;
  verifier_name: string | null;
}

export default function LandlordNotifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  // Load reviewed status from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("reviewed-landlords");
    if (stored) {
      try {
        setReviewedIds(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error("Error loading reviewed status:", e);
      }
    }
  }, []);

  // Save reviewed status to localStorage
  const saveReviewedStatus = (ids: Set<string>) => {
    localStorage.setItem("reviewed-landlords", JSON.stringify([...ids]));
    setReviewedIds(ids);
  };

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["landlord-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landlords")
        .select(`
          id,
          landlord_name,
          landlord_phone,
          properties,
          village_cell_location,
          is_verified,
          verified_at,
          verified_by,
          created_at,
          registered_by,
          agents!landlords_registered_by_fkey (
            id,
            profiles!agents_user_id_fkey (
              full_name,
              phone_number
            )
          ),
          verifier:profiles!landlords_verified_by_fkey (
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((l: any) => ({
        id: l.id,
        landlord_name: l.landlord_name,
        landlord_phone: l.landlord_phone,
        properties: l.properties,
        village_cell_location: l.village_cell_location,
        is_verified: l.is_verified,
        verified_at: l.verified_at,
        verified_by: l.verified_by,
        created_at: l.created_at,
        registered_by: l.registered_by,
        agent_name: l.agents?.profiles?.full_name || "Unknown",
        agent_phone: l.agents?.profiles?.phone_number || "",
        verifier_name: l.verifier?.full_name || null,
      }));
    },
  });

  const filteredNotifications = notifications.filter((notif) =>
    notif.landlord_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notif.landlord_phone.includes(searchQuery) ||
    notif.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreviewed = filteredNotifications.filter((n) => !reviewedIds.has(n.id));
  const reviewed = filteredNotifications.filter((n) => reviewedIds.has(n.id));

  const handleMarkReviewed = (id: string) => {
    const newReviewed = new Set(reviewedIds);
    newReviewed.add(id);
    saveReviewedStatus(newReviewed);
    haptics.light();
    toast.success("Marked as reviewed");
  };

  const handleMarkUnreviewed = (id: string) => {
    const newReviewed = new Set(reviewedIds);
    newReviewed.delete(id);
    saveReviewedStatus(newReviewed);
    haptics.light();
    toast.success("Marked as unreviewed");
  };

  const handleMarkAllReviewed = () => {
    const allIds = new Set([...reviewedIds, ...unreviewed.map((n) => n.id)]);
    saveReviewedStatus(allIds);
    haptics.success();
    toast.success(`Marked ${unreviewed.length} notifications as reviewed`);
  };

  const handleClearReviewed = () => {
    saveReviewedStatus(new Set());
    haptics.light();
    toast.success("Cleared all reviewed status");
  };

  const NotificationCard = ({ notification, isReviewed }: { notification: LandlordNotification; isReviewed: boolean }) => (
    <Card
      className={`p-4 cursor-pointer transition-all hover:shadow-md ${
        isReviewed ? "opacity-60" : ""
      }`}
      onClick={() => navigate(`/manager/landlord/${notification.id}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold text-lg">{notification.landlord_name}</h3>
                <p className="text-sm text-muted-foreground">{notification.landlord_phone}</p>
              </div>
            </div>
            <Badge variant={notification.is_verified ? "default" : "secondary"}>
              {notification.is_verified ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </>
              )}
            </Badge>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {notification.properties && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Properties:</span>
                <span className="font-medium">{notification.properties}</span>
              </div>
            )}
            {notification.village_cell_location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium">{notification.village_cell_location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Registered by:</span>
              <span className="font-medium">{notification.agent_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Verification Status */}
          {notification.is_verified && notification.verified_at && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>
                Verified {formatDistanceToNow(new Date(notification.verified_at), { addSuffix: true })}
                {notification.verifier_name && ` by ${notification.verifier_name}`}
              </span>
            </div>
          )}
        </div>

        {/* Review Action */}
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          {isReviewed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMarkUnreviewed(notification.id)}
            >
              <EyeOff className="h-4 w-4 mr-1" />
              Unmark
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkReviewed(notification.id)}
            >
              <Eye className="h-4 w-4 mr-1" />
              Mark Reviewed
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Landlord Notifications</h1>
          <p className="text-muted-foreground">Track landlord registration and verification activity</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClearReviewed}>
            Clear All
          </Button>
          <Button size="sm" onClick={handleMarkAllReviewed} disabled={unreviewed.length === 0}>
            <Eye className="h-4 w-4 mr-1" />
            Mark All Reviewed ({unreviewed.length})
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Landlords</div>
          <div className="text-2xl font-bold">{notifications.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Unreviewed</div>
          <div className="text-2xl font-bold text-orange-600">{unreviewed.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Reviewed</div>
          <div className="text-2xl font-bold text-green-600">{reviewed.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Verified</div>
          <div className="text-2xl font-bold text-primary">
            {notifications.filter((n) => n.is_verified).length}
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by landlord name, phone, or agent..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="unreviewed" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unreviewed">
            Unreviewed ({unreviewed.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed">
            Reviewed ({reviewed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unreviewed" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading notifications...</div>
          ) : unreviewed.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
              <p className="text-muted-foreground">No unreviewed landlord notifications</p>
            </Card>
          ) : (
            unreviewed.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                isReviewed={false}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="space-y-4">
          {reviewed.length === 0 ? (
            <Card className="p-12 text-center">
              <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Reviewed Notifications</h3>
              <p className="text-muted-foreground">Mark notifications as reviewed to track them here</p>
            </Card>
          ) : (
            reviewed.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                isReviewed={true}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

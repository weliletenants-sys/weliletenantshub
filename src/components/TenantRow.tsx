import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { TableRow, TableCell } from "./ui/table";
import { Badge } from "./ui/badge";
import { DollarSign, FileText } from "lucide-react";
import { haptics } from "@/utils/haptics";
import QuickPaymentDialog from "./QuickPaymentDialog";

interface TenantRowProps {
  tenant: any;
  activeTab: string;
  observeTenantRow?: (element: HTMLElement | null) => void;
  getStatusBadge: (status: string) => JSX.Element;
}

export const TenantRow = ({ 
  tenant, 
  activeTab, 
  observeTenantRow,
  getStatusBadge 
}: TenantRowProps) => {
  const navigate = useNavigate();
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  useEffect(() => {
    if (observeTenantRow && rowRef.current) {
      observeTenantRow(rowRef.current);
    }
  }, [observeTenantRow]);

  const handleClick = () => {
    navigate(`/agent/tenants/${tenant.id}`);
  };

  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      const offset = eventData.deltaX;
      // Limit swipe distance
      const maxOffset = 80;
      const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, offset));
      setSwipeOffset(limitedOffset);
      
      // Haptic feedback at thresholds
      if (Math.abs(limitedOffset) > 40 && Math.abs(offset - limitedOffset) < 5) {
        haptics.light();
      }
    },
    onSwipedLeft: () => {
      if (Math.abs(swipeOffset) > 40) {
        haptics.medium();
        setShowPaymentDialog(true);
      }
      setSwipeOffset(0);
    },
    onSwipedRight: () => {
      if (Math.abs(swipeOffset) > 40) {
        haptics.medium();
        navigate(`/agent/tenants/${tenant.id}`);
      }
      setSwipeOffset(0);
    },
    onTap: () => {
      setSwipeOffset(0);
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
    delta: 10,
  });

  return (
    <>
      <div className="relative overflow-hidden" {...swipeHandlers}>
        {/* Swipe indicators */}
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-primary/10 transition-all"
          style={{
            width: swipeOffset < -10 ? Math.abs(swipeOffset) : 0,
            opacity: swipeOffset < -10 ? Math.min(Math.abs(swipeOffset) / 60, 1) : 0,
          }}
        >
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center bg-accent/10 transition-all"
          style={{
            width: swipeOffset > 10 ? swipeOffset : 0,
            opacity: swipeOffset > 10 ? Math.min(swipeOffset / 60, 1) : 0,
          }}
        >
          <FileText className="h-6 w-6 text-accent" />
        </div>

        <TableRow
          ref={rowRef}
          data-tenant-id={tenant.id}
          className="cursor-pointer hover:bg-muted/50 active:bg-muted transition-all h-16"
          onClick={handleClick}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 ? "transform 0.2s ease-out" : "none",
          }}
        >
          <TableCell className="font-semibold">{tenant.tenant_name}</TableCell>
          <TableCell className="text-sm">{tenant.tenant_phone}</TableCell>
          <TableCell className="font-medium">
            {tenant.rent_amount ? (parseInt(tenant.rent_amount) / 1000).toFixed(0) : "0"}K
          </TableCell>
          <TableCell>{getStatusBadge(tenant.status || "pending")}</TableCell>
          <TableCell>
            {activeTab === "overdue" && tenant.isOverdue ? (
              <Badge variant="destructive" className="font-bold">
                {tenant.daysOverdue}d
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">
                {tenant.days_remaining !== null && tenant.days_remaining !== undefined
                  ? `${tenant.days_remaining}d`
                  : "N/A"}
              </span>
            )}
          </TableCell>
          <TableCell className="font-bold text-right">
            {tenant.outstanding_balance !== null && tenant.outstanding_balance !== undefined ? (
              <span className={tenant.outstanding_balance > 0 ? "text-destructive" : "text-success"}>
                {(parseInt(tenant.outstanding_balance) / 1000).toFixed(0)}K
              </span>
            ) : (
              "N/A"
            )}
          </TableCell>
        </TableRow>
      </div>

      <QuickPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        tenant={tenant}
      />
    </>
  );
};

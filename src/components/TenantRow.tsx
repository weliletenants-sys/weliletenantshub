import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TableRow, TableCell } from "./ui/table";
import { Badge } from "./ui/badge";

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

  useEffect(() => {
    if (observeTenantRow && rowRef.current) {
      observeTenantRow(rowRef.current);
    }
  }, [observeTenantRow]);

  const handleClick = () => {
    navigate(`/agent/tenants/${tenant.id}`);
  };

  return (
    <TableRow
      ref={rowRef}
      data-tenant-id={tenant.id}
      className="cursor-pointer hover:bg-muted/50 active:bg-muted transition-all h-16"
      onClick={handleClick}
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
  );
};

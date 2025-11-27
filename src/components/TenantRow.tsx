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
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={handleClick}
    >
      <TableCell className="font-medium">{tenant.tenant_name}</TableCell>
      <TableCell>{tenant.tenant_phone}</TableCell>
      <TableCell>
        UGX {tenant.rent_amount ? parseInt(tenant.rent_amount).toLocaleString() : "0"}
      </TableCell>
      <TableCell>{getStatusBadge(tenant.status || "pending")}</TableCell>
      <TableCell>
        {activeTab === "overdue" && tenant.isOverdue ? (
          <Badge variant="destructive" className="font-bold">
            {tenant.daysOverdue} {tenant.daysOverdue === 1 ? "day" : "days"}
          </Badge>
        ) : (
          <span className="text-muted-foreground">
            {tenant.days_remaining !== null && tenant.days_remaining !== undefined
              ? `${tenant.days_remaining} days`
              : "N/A"}
          </span>
        )}
      </TableCell>
      <TableCell className="font-semibold text-right">
        {tenant.outstanding_balance !== null && tenant.outstanding_balance !== undefined ? (
          <span className={tenant.outstanding_balance > 0 ? "text-destructive" : "text-success"}>
            UGX {parseInt(tenant.outstanding_balance).toLocaleString()}
          </span>
        ) : (
          "N/A"
        )}
      </TableCell>
    </TableRow>
  );
};

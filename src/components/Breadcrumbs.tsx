import { useLocation, useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home, ChevronRight } from "lucide-react";
import { Fragment } from "react";

interface BreadcrumbSegment {
  label: string;
  path: string;
  isCurrentPage: boolean;
}

const getBreadcrumbs = (pathname: string): BreadcrumbSegment[] => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Home", path: "/", isCurrentPage: pathname === "/" }
  ];

  let currentPath = "";
  
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    
    // Format segment label
    let label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Special cases for better labels
    if (segment === 'ai-assistant') label = 'AI Assistant';
    if (segment === 'weekly-summary') label = 'Weekly Report';
    if (segment === 'new-tenant') label = 'New Tenant';
    if (segment === 'offline-queue') label = 'Offline Queue';
    if (segment === 'profile-repair') label = 'Profile Repair';
    
    breadcrumbs.push({
      label,
      path: currentPath,
      isCurrentPage: isLast
    });
  });

  return breadcrumbs;
};

const Breadcrumbs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  // Don't show breadcrumbs on home page or login/install pages
  if (location.pathname === "/" || location.pathname === "/login" || location.pathname === "/install") {
    return null;
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => (
          <Fragment key={crumb.path}>
            {index > 0 && (
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
            )}
            <BreadcrumbItem>
              {crumb.isCurrentPage ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  onClick={() => navigate(crumb.path)}
                  className="cursor-pointer flex items-center gap-1"
                >
                  {index === 0 && <Home className="h-3.5 w-3.5" />}
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default Breadcrumbs;

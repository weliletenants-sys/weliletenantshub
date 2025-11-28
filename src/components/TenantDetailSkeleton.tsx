import { Card, CardContent, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export const TenantDetailSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Content Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-32" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Cards */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
};

export const TenantListSkeleton = () => {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const DashboardSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 animate-pulse" />
        <Skeleton className="h-4 w-32 animate-pulse" style={{ animationDelay: '0.1s' }} />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-xl animate-pulse shadow-lg" />
        <Skeleton className="h-12 w-full rounded-xl animate-pulse shadow-lg" style={{ animationDelay: '0.1s' }} />
      </div>

      {/* Motorcycle Progress Card */}
      <Card className="animate-pulse bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-48" />
              </div>
            </div>
            <Skeleton className="h-6 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collection Targets */}
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
};

export const CollectionsSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 animate-pulse" />
        <Skeleton className="h-4 w-64 animate-pulse" style={{ animationDelay: '0.1s' }} />
      </div>

      {/* Alert Card */}
      <Card className="border-destructive/50 bg-destructive/5 animate-pulse">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
      </Card>

      {/* Collection Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-10 w-20 rounded-lg" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const EarningsSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32 animate-pulse" />
        <Skeleton className="h-4 w-48 animate-pulse" style={{ animationDelay: '0.1s' }} />
      </div>

      {/* Wallet Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 animate-pulse">
        <CardContent className="p-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Earnings Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Portfolio Value */}
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>

      {/* Recent Earnings */}
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export const WeeklySummarySkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 animate-pulse" />
        <Skeleton className="h-4 w-64 animate-pulse" style={{ animationDelay: '0.1s' }} />
      </div>

      {/* Week Selector */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-32 rounded-lg animate-pulse" />
        <Skeleton className="h-10 w-48 rounded-lg animate-pulse" />
        <Skeleton className="h-10 w-32 rounded-lg animate-pulse" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card className="animate-pulse" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export const ManagerDashboardSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 animate-pulse" />
        <Skeleton className="h-4 w-40 animate-pulse" style={{ animationDelay: '0.1s' }} />
      </div>

      {/* Summary Stats Grid - 4 columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Portfolio Value Card with Trend */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 animate-pulse">
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-48" />
              </div>
              <Skeleton className="h-12 w-12 rounded-xl" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Growth Comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="animate-pulse" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Chart */}
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
};

export const AgentsListSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 animate-pulse" />
          <Skeleton className="h-4 w-64 animate-pulse" style={{ animationDelay: '0.1s' }} />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg animate-pulse" style={{ animationDelay: '0.2s' }} />
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg animate-pulse" />
        <Skeleton className="h-10 w-32 rounded-lg animate-pulse" style={{ animationDelay: '0.1s' }} />
        <Skeleton className="h-10 w-10 rounded-lg animate-pulse" style={{ animationDelay: '0.2s' }} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.05}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agents Table */}
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Table Header */}
            <div className="flex items-center gap-4 pb-3 border-b">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Table Rows */}
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 animate-pulse" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-lg animate-pulse" />
          <Skeleton className="h-10 w-20 rounded-lg animate-pulse" />
          <Skeleton className="h-10 w-10 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export const AgentDetailSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <Skeleton className="h-10 w-32 rounded-lg animate-pulse" />

      {/* Agent Header */}
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Content Area */}
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export const PaymentVerificationsSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 animate-pulse" />
        <Skeleton className="h-4 w-72 animate-pulse" style={{ animationDelay: '0.1s' }} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-40 rounded-lg animate-pulse" />
        <Skeleton className="h-10 w-40 rounded-lg animate-pulse" />
        <Skeleton className="h-10 flex-1 rounded-lg animate-pulse" />
      </div>

      {/* Verification Cards */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-7 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-24 rounded-lg" />
                  <Skeleton className="h-10 w-24 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const AuditLogSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 animate-pulse" />
        <Skeleton className="h-4 w-64 animate-pulse" style={{ animationDelay: '0.1s' }} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Skeleton className="h-10 rounded-lg animate-pulse" />
        <Skeleton className="h-10 rounded-lg animate-pulse" />
        <Skeleton className="h-10 rounded-lg animate-pulse" />
        <Skeleton className="h-10 rounded-lg animate-pulse" />
      </div>

      {/* Audit Log Entries */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.05}s` }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const PortfolioBreakdownSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg animate-pulse" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-56 animate-pulse" style={{ animationDelay: '0.05s' }} />
          <Skeleton className="h-4 w-72 animate-pulse" style={{ animationDelay: '0.1s' }} />
        </div>
      </div>

      {/* Date Filter and Export */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-10 w-32 rounded-lg animate-pulse" />
          <Skeleton className="h-10 w-32 rounded-lg animate-pulse" style={{ animationDelay: '0.05s' }} />
          <Skeleton className="h-10 w-32 rounded-lg animate-pulse" style={{ animationDelay: '0.1s' }} />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg animate-pulse" style={{ animationDelay: '0.15s' }} />
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.08}s` }}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Portfolio Breakdown */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.08}s` }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-6 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const NotificationsPanelSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 animate-pulse" />
          <Skeleton className="h-4 w-64 animate-pulse" style={{ animationDelay: '0.05s' }} />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg animate-pulse" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>

      {/* Search */}
      <Skeleton className="h-10 w-full rounded-lg animate-pulse" />

      {/* Notification Cards */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.06}s` }}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              </div>
            </CardHeader>
            {i % 2 === 0 && (
              <CardContent className="pt-0 border-t">
                <div className="flex items-center gap-2 mt-3">
                  <Skeleton className="h-9 flex-1 rounded-lg" />
                  <Skeleton className="h-9 w-20 rounded-lg" />
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export const SearchResultsSkeleton = () => {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40 animate-pulse" />
        <Skeleton className="h-4 w-32 animate-pulse" style={{ animationDelay: '0.05s' }} />
      </div>

      {/* Result Cards */}
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="animate-pulse hover:shadow-md transition-shadow cursor-pointer" style={{ animationDelay: `${i * 0.08}s` }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-9 w-24 rounded-lg flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const MessageThreadSkeleton = () => {
  return (
    <div className="space-y-4 animate-fade-in p-4">
      {/* Thread Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <Skeleton className="h-10 w-10 rounded-full animate-pulse" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48 animate-pulse" />
          <Skeleton className="h-3 w-32 animate-pulse" style={{ animationDelay: '0.05s' }} />
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''} animate-pulse`} style={{ animationDelay: `${i * 0.08}s` }}>
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className={`flex-1 max-w-[75%] space-y-2 ${i % 2 === 0 ? 'items-end' : 'items-start'}`}>
              <Skeleton className="h-3 w-24" />
              <div className={`rounded-2xl p-4 space-y-2 ${i % 2 === 0 ? 'bg-primary/10' : 'bg-muted'}`}>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      <div className="flex items-end gap-2 pt-4 border-t">
        <Skeleton className="h-20 flex-1 rounded-lg animate-pulse" />
        <Skeleton className="h-10 w-20 rounded-lg animate-pulse" />
      </div>
    </div>
  );
};

export const SettingsSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32 animate-pulse" />
        <Skeleton className="h-4 w-56 animate-pulse" style={{ animationDelay: '0.05s' }} />
      </div>

      {/* Profile Section */}
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card className="animate-pulse" style={{ animationDelay: '0.1s' }}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg animate-pulse" />
        <Skeleton className="h-10 w-32 rounded-lg animate-pulse" />
      </div>
    </div>
  );
};

export const FormSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Form Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 animate-pulse" />
        <Skeleton className="h-4 w-96 animate-pulse" style={{ animationDelay: '0.05s' }} />
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2 animate-pulse" style={{ animationDelay: `${i * 0.06}s` }}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
            {i === 3 && <Skeleton className="h-3 w-48" />}
          </div>
        ))}
      </div>

      {/* Form Actions */}
      <div className="flex items-center gap-3 pt-4">
        <Skeleton className="h-10 w-32 rounded-lg animate-pulse" />
        <Skeleton className="h-10 flex-1 rounded-lg animate-pulse" />
      </div>
    </div>
  );
};

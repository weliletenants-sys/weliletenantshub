# Manager Real-Time Visibility

## Overview

This document outlines the comprehensive real-time synchronization system that ensures managers see every agent activity instantly across all manager dashboard pages, including the new live activity feed component.

## Live Activity Feed

### Overview
The Live Activity Feed is a real-time component that displays a continuous stream of agent activities on the manager dashboard. It provides instant visibility into all agent actions across the platform.

### Location
Displayed prominently on the Manager Dashboard (`/manager/dashboard`), positioned after the summary statistics cards.

### Features

**Activity Types Tracked:**
- **Tenant additions** - When agents add new tenants to the system
- **Tenant updates** - When agents modify tenant information
- **Tenant deletions** - When agents or managers remove tenants
- **Payment recordings** - When agents record rent payments
- **Profile updates** - When agents update their profile information

**Visual Design:**
- Real-time "Live" badge with pulsing green indicator
- Scrollable feed showing up to 20 most recent activities
- Color-coded icons for different activity types
- Relative timestamps (e.g., "2 minutes ago")
- Agent names prominently displayed
- Activity descriptions with relevant details (tenant names, payment amounts)

**Real-Time Updates:**
The activity feed automatically updates when:
- Any agent adds, edits, or deletes a tenant
- Any agent records a payment
- Any profile is updated
- Audit log entries are created

### Component: `ActivityFeed`

**Location:** `src/components/ActivityFeed.tsx`

**Props:**
- `maxItems?: number` - Maximum number of activities to display (default: 15)
- `className?: string` - Additional CSS classes for styling

**Implementation:**
```typescript
<ActivityFeed maxItems={20} className="lg:col-span-2" />
```

**Data Sources:**
1. **Audit Logs** - Fetches from `audit_logs` table for tenant and profile changes
2. **Collections** - Fetches from `collections` table for payment recordings
3. **Real-Time Subscriptions** - Uses `registerSyncCallback` to listen for table changes

**Activity Icons:**
- 🟢 Green UserPlus icon - Tenant added
- 🔵 Blue Edit icon - Tenant updated
- 🔴 Red Trash icon - Tenant deleted
- 💜 Purple DollarSign icon - Payment recorded
- ⚪ Gray Edit icon - Profile updated

### Integration with Real-Time System

The activity feed integrates seamlessly with the existing real-time infrastructure:

```typescript
useEffect(() => {
  fetchRecentActivities();

  // Listen for real-time updates
  const unregisterCallback = registerSyncCallback((table) => {
    if (table === 'tenants' || table === 'collections' || table === 'profiles') {
      console.log(`Real-time update detected on ${table}, refreshing activity feed`);
      fetchRecentActivities();
    }
  });

  return () => {
    unregisterCallback();
  };
}, []);
```

## Real-Time Infrastructure

### Core Hooks

The application uses Supabase Realtime to provide instant data synchronization:

- `useRealtimeAllTenants()` - Subscribes to all tenant changes across all agents
- `useRealtimeAllCollections()` - Subscribes to all payment/collection changes
- `useRealtimeAgents()` - Subscribes to all agent profile/stats changes  
- `useRealtimeProfiles()` - Subscribes to all user profile changes
- `registerSyncCallback()` - Allows components to listen for sync events

All hooks are defined in `src/hooks/useRealtimeSubscription.ts`.

## Manager Pages with Real-Time Updates

### 1. Manager Dashboard (`/manager/dashboard`)

**Real-time subscriptions:**
- `useRealtimeAllTenants()`
- `useRealtimeAllCollections()`
- `useRealtimeAgents()`

**What updates in real-time:**
- **Live Activity Feed** - Real-time stream of recent agent actions (NEW)
  - Tenant additions with agent names
  - Payment recordings with amounts and tenant names
  - Tenant updates and deletions
  - Profile modifications
  - Auto-refreshes when new activities occur
- Total agents count
- Total tenants count
- Pending verifications count
- Total portfolio value (with toast notifications when changed)
- Pending payments count
- Payment verification stats
- Agent growth comparison
- Payment method breakdown charts

**Visual feedback:**
- **Activity Feed** - Live badge with pulsing indicator, scrollable feed with icons
- Toast notifications for portfolio value changes
- Toast notifications for new tenants added
- Toast notifications for pending verifications
- Toast notifications for pending payments
- Haptic feedback on notifications
- `DataSyncBadge` components showing sync status

### 2. Agents List (`/manager/agents`)

**Real-time subscriptions:**
- `useRealtimeAgents()`
- `useRealtimeAllTenants()`
- `useRealtimeProfiles()`

**What updates in real-time:**
- Agent list with stats
- Tenant counts per agent
- Portfolio values per agent
- Collection rates
- Monthly earnings
- Motorcycle eligibility status

### 3. Agent Detail (`/manager/agents/:agentId`)

**Real-time subscriptions:**
- `useRealtimeAgents()`
- `useRealtimeAllTenants()`
- `useRealtimeAllCollections()`
- `useRealtimeProfiles()`

**What updates in real-time:**
- Agent performance metrics
- Tenant list for the agent
- Payment history
- Portfolio value
- Collection rates

### 4. Payment Verifications (`/manager/verifications`)

**Real-time subscriptions:**
- Direct channel subscription to `collections` table

**What updates in real-time:**
- New payment submissions from agents
- Payment status changes (verified/rejected)
- Payment counts (pending, verified, rejected)

### 5. Tenant Detail (`/manager/tenants/:tenantId`)

**Real-time subscriptions:**
- `useRealtimeAllTenants()`
- `useRealtimeAllCollections()`

**What updates in real-time:**
- Tenant information edits
- Payment records for the tenant
- Outstanding balance changes
- Transfer history

### 6. Portfolio Breakdown (`/manager/portfolio`)

**Real-time subscriptions:**
- `useRealtimeAllTenants()`

**What updates in real-time:**
- Total portfolio value across all agents
- Portfolio breakdown by agent
- Tenant counts per agent
- Tenant outstanding balances

### 7. Verification History (`/manager/verification-history`)

**Real-time subscriptions:**
- `useRealtimeAllCollections()`

**What updates in real-time:**
- Verification records (approved/rejected)
- Verification trend data
- Payment method statistics

### 8. Audit Log (`/manager/audit`)

**Real-time subscriptions:**
- `registerSyncCallback()` for all table changes

**What updates in real-time:**
- Audit log entries for all manager actions
- Tenant edits/deletions
- Agent modifications
- Profile updates

### 9. Weekly Report (`/manager/weekly-report`)

**Real-time subscriptions:**
- `useRealtimeAgents()`
- `useRealtimeAllCollections()`
- `useRealtimeProfiles()`

**What updates in real-time:**
- Weekly agent performance metrics
- Weekly collection totals
- Week-over-week comparisons

## How Real-Time Works

### 1. Database Configuration

All critical tables have `REPLICA IDENTITY FULL` enabled and are added to the `supabase_realtime` publication:

```sql
ALTER TABLE public.tenants REPLICA IDENTITY FULL;
ALTER TABLE public.collections REPLICA IDENTITY FULL;
ALTER TABLE public.agents REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
```

### 2. Subscription Pattern

Each real-time hook follows this pattern:

```typescript
export const useRealtimeAllTenants = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('all-tenants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
        },
        (payload) => {
          console.log('Realtime tenant change (manager):', payload);
          
          // Notify sync indicators
          notifySyncEvent('tenants');
          
          // Invalidate React Query cache
          queryClient.invalidateQueries({ queryKey: ['tenants'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
```

### 3. Sync Callbacks

Components can register callbacks to refetch data when specific tables change:

```typescript
useEffect(() => {
  const unregisterCallback = registerSyncCallback((table) => {
    if (table === 'tenants' || table === 'collections') {
      console.log(`Real-time update detected on ${table}, refreshing data`);
      fetchData();
    }
  });

  return () => {
    unregisterCallback();
  };
}, [dependencies]);
```

## Agent Actions That Trigger Real-Time Updates

### Tenant Management
- **Add new tenant** → Triggers `tenants` table update → Manager sees new tenant instantly
- **Edit tenant details** → Triggers `tenants` table update → Manager sees changes instantly  
- **Delete tenant** → Triggers `tenants` table update → Manager sees removal instantly
- **Update tenant balance** → Triggers `tenants` table update → Portfolio values update instantly

### Payment Recording
- **Record payment** → Triggers `collections` table insert → Manager sees new payment instantly
- **Payment status changes** → Triggers `collections` table update → Manager sees status change instantly
- **Payment verification** → Triggers `collections` table update → Agent sees verification instantly

### Agent Profile
- **Update agent profile** → Triggers `profiles` table update → Manager sees profile change instantly
- **Portfolio changes** → Triggers `agents` table update → Manager sees stats update instantly

## Visual Feedback

Managers receive multiple forms of feedback for real-time updates:

1. **Toast Notifications** - Pop-up messages for significant events
2. **Haptic Feedback** - Vibrations on mobile for important updates
3. **Sync Indicators** - Visual pulsing indicators showing when data is syncing
4. **Badge Updates** - Real-time count updates on badges
5. **Live Data Refresh** - Tables and lists update without page reload

## Performance Considerations

- **Connection Management** - Each hook creates a single channel that's cleaned up on unmount
- **Query Invalidation** - Uses React Query's intelligent cache invalidation
- **Deduplication** - Prevents multiple refetches for the same event
- **Offline Handling** - Supabase automatically reconnects when online
- **Network Efficiency** - Only subscribes to relevant table changes per page

## Security

Real-time subscriptions respect Row Level Security (RLS) policies:

- Managers can only see data they have permission to access via RLS
- All real-time events pass through the same RLS checks as direct queries
- No additional security configuration needed

## Testing Real-Time Updates

To test that managers see agent activities in real-time:

1. Open manager dashboard in one browser tab
2. Open agent dashboard in another browser tab (or different device)
3. As agent, add a new tenant
4. Manager dashboard should instantly show:
   - Increased tenant count
   - Toast notification for new tenant
   - Updated portfolio value
   - New tenant in lists

5. As agent, record a payment
6. Manager dashboard should instantly show:
   - New payment in verification queue
   - Toast notification for pending payment
   - Updated stats

7. As manager, verify the payment
8. Agent should instantly see:
   - Payment status changed to "verified"
   - Updated commission

## Troubleshooting

If real-time updates are not working:

1. Check browser console for Supabase connection errors
2. Verify database tables have `REPLICA IDENTITY FULL`
3. Verify tables are in `supabase_realtime` publication
4. Check RLS policies allow manager to access the data
5. Ensure WebSocket connection is not blocked by firewall

## Future Enhancements

Potential improvements to the real-time system and activity feed:

- **Activity filtering** - Filter activity feed by activity type or agent
- **Activity search** - Search through historical activities
- **Activity export** - Export activity history to CSV/PDF
- **Activity notifications** - Desktop/mobile push notifications for critical activities
- **Presence indicators** - Show which managers/agents are currently online
- **Conflict resolution** - Handle simultaneous edits from multiple users
- **Sound notifications** - Optional audio alerts for critical events
- **Real-time charts** - Live updating visualization of metrics
- **Activity details modal** - Click activities to see full details and related records

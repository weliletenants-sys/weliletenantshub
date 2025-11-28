# Live Activity Feed

## Overview

The Live Activity Feed is a real-time component that provides managers with instant visibility into all agent activities across the platform. It displays a continuous stream of recent actions including tenant management, payment recordings, and profile updates.

## Features

### Real-Time Updates
- **Automatic Refresh** - Updates instantly when any agent performs an action
- **No Manual Refresh Required** - Powered by Supabase Realtime subscriptions
- **Live Indicator** - Pulsing green badge shows the feed is actively connected

### Advanced Filtering

**Filter by Activity Type:**
- All Types (default)
- Tenant Added
- Tenant Updated
- Tenant Deleted
- Payment Recorded
- Profile Updated

**Filter by Agent:**
- All Agents (default)
- Select specific agent from dropdown
- Dropdown populated with all agents who have activities

**Filter by Date Range:**
- Start Date - Filter activities from this date onwards
- End Date - Filter activities up to this date
- Date pickers with calendar UI
- Combines with other filters for precise results

**Filter Controls:**
- Collapsible filter panel to save space
- Visual indicator showing number of active filters
- "Clear All Filters" button to reset all criteria
- Real-time filtering - results update instantly
- Empty state shows appropriate message based on filters

### Activity Types

1. **Tenant Added** 🟢
   - Displayed when agents create new tenants
   - Shows agent name and tenant name
   - Green UserPlus icon

2. **Tenant Updated** 🔵
   - Displayed when tenant information is modified
   - Shows agent name and tenant name
   - Blue Edit icon

3. **Tenant Deleted** 🔴
   - Displayed when tenants are removed from the system
   - Shows agent/manager name and tenant name
   - Red Trash icon

4. **Payment Recorded** 💜
   - Displayed when agents record rent payments
   - Shows agent name, payment amount, and tenant name
   - Purple DollarSign icon

5. **Profile Updated** ⚪
   - Displayed when agents update their profiles
   - Shows agent name
   - Gray Edit icon

### Visual Design

**Layout:**
- Prominent placement on manager dashboard
- Scrollable feed container (400px height)
- Clean card-based design
- Responsive on all screen sizes

**Activity Cards:**
- Icon with colored background indicating activity type
- Agent name in bold
- Activity description in regular text
- Activity type badge
- Relative timestamp (e.g., "2 minutes ago")
- Hover effect for interactivity

**Empty State:**
- Centered icon and message
- Encourages waiting for agent activities

### Timestamps

Uses `date-fns` library to display human-readable relative times:
- "just now" - Less than a minute ago
- "2 minutes ago" - Recent activities
- "1 hour ago" - Within the last hour
- "yesterday" - Previous day
- "2 days ago" - Older activities

## Implementation

### Component Location
`src/components/ActivityFeed.tsx`

### Usage

```typescript
import { ActivityFeed } from "@/components/ActivityFeed";

// Basic usage
<ActivityFeed />

// With custom max items
<ActivityFeed maxItems={30} />

// With custom styling
<ActivityFeed maxItems={20} className="shadow-lg" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxItems` | `number` | `15` | Maximum number of activities to fetch from database |
| `className` | `string` | `undefined` | Additional CSS classes for styling |

**Note:** The `maxItems` prop controls the initial fetch limit. Filters are applied client-side to the fetched activities.

### Data Fetching

The component fetches data from two primary sources:

1. **Audit Logs Table** (`audit_logs`)
   - Tracks all tenant modifications (add, update, delete)
   - Tracks profile updates
   - Includes manager/agent information

2. **Collections Table** (`collections`)
   - Tracks all payment recordings
   - Includes tenant and agent information
   - Shows payment amounts and methods

### Real-Time Subscription

```typescript
useEffect(() => {
  fetchRecentActivities();

  // Register callback for real-time updates
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

## Integration

### Manager Dashboard

The activity feed is integrated into the Manager Dashboard at `/manager/dashboard`:

```typescript
import { ActivityFeed } from "@/components/ActivityFeed";

// Positioned after stats cards
<ActivityFeed maxItems={20} className="lg:col-span-2" />
```

### Filter Usage Guide

**Quick Filtering:**
1. Click the "Filters" button to expand the filter panel
2. Select your filter criteria:
   - **Activity Type**: Choose specific action type or "All Types"
   - **Agent**: Select individual agent or "All Agents"
   - **Date Range**: Pick start and/or end dates for time-based filtering
3. Results update automatically as you adjust filters
4. Active filter count shown in badge next to "Filters" button
5. Click "Clear All Filters" to reset

**Common Filter Scenarios:**

**Scenario 1: View Today's Payments**
- Activity Type: "Payment Recorded"
- Start Date: Today
- End Date: Today

**Scenario 2: Track Specific Agent's Work**
- Agent: Select agent name
- Activity Type: "All Types"
- Date Range: Last 7 days

**Scenario 3: Monitor Recent Tenant Changes**
- Activity Type: "Tenant Added" or "Tenant Updated"
- Date Range: Last 24 hours

**Scenario 4: Audit Trail for Deletions**
- Activity Type: "Tenant Deleted"
- Date Range: Custom range

## Performance

### Optimization Strategies

1. **Query Limits** - Only fetches most recent activities (configurable via `maxItems`)
2. **Efficient Filtering** - Filters only relevant tables (tenants, collections, profiles)
3. **Batch Fetching** - Fetches profiles in a single query to minimize database calls
4. **Smart Merging** - Combines audit logs and collections efficiently
5. **Subscription Cleanup** - Properly unregisters callbacks on unmount

### Database Queries

- **Audit Logs**: Limited to 15-30 recent records
- **Collections**: Limited to 15-30 recent records
- **Profiles**: Batched fetch for all unique user IDs

## Testing

### Manual Testing

**Basic Functionality:**
1. **Open Manager Dashboard** - Navigate to `/manager/dashboard`
2. **Verify Feed Display** - Activity feed should be visible below stats cards
3. **Open Agent Dashboard** - In another browser tab/window
4. **Add Tenant** - Create a new tenant as an agent
5. **Check Feed** - Manager dashboard should instantly show "Agent added tenant X"
6. **Record Payment** - Record a payment as an agent
7. **Check Feed** - Manager dashboard should instantly show "Agent recorded payment of UGX X from Tenant Y"
8. **Update Profile** - Change agent profile information
9. **Check Feed** - Manager dashboard should instantly show "Agent updated their profile"

**Filter Testing:**
1. **Open Filters** - Click "Filters" button to expand filter panel
2. **Filter by Type** - Select "Payment Recorded" from activity type dropdown
   - Verify only payment activities are shown
3. **Filter by Agent** - Select a specific agent from agent dropdown
   - Verify only that agent's activities are shown
4. **Filter by Date Range** - Select start and end dates
   - Verify only activities within date range are shown
5. **Combine Filters** - Apply multiple filters simultaneously
   - Verify results match all filter criteria
6. **Clear Filters** - Click "Clear All Filters" button
   - Verify all activities are shown again
7. **Empty State** - Apply filters that match no activities
   - Verify appropriate "No activities match your filters" message
   - Verify "Clear Filters" button appears in empty state

### Console Monitoring

Open browser console to see real-time events:
```
Real-time update detected on tenants, refreshing activity feed
Real-time update detected on collections, refreshing activity feed
```

## Troubleshooting

### Feed Not Updating

1. **Check WebSocket Connection** - Ensure Supabase Realtime is connected
2. **Verify RLS Policies** - Manager must have permission to view activities
3. **Check Console** - Look for JavaScript errors
4. **Refresh Page** - Hard refresh to clear any caching issues

### Missing Activities

1. **Check Audit Logs** - Verify audit logs are being created for actions
2. **Check Filters** - Ensure filters are not hiding the activities
3. **Check Time Limit** - Older activities may be outside the fetch limit
4. **Clear Filters** - Use "Clear All Filters" to reset filter state

### Performance Issues

1. **Reduce maxItems** - Lower the number of displayed activities
2. **Check Database Performance** - Ensure indexes are optimal
3. **Monitor Network** - Check for slow queries or large payloads

## Future Enhancements

Planned improvements for the activity feed:

1. **Enhanced Filtering** ✅ **IMPLEMENTED**
   - ✅ Filter by activity type (tenant, payment, profile)
   - ✅ Filter by specific agent
   - ✅ Filter by date range
   - Future: Save filter presets
   - Future: Multi-select for activity types

2. **Activity Search**
   - Full-text search across all activities
   - Search by tenant name, agent name, or amount
   - Search highlighting in results

3. **Activity Details**
   - Click activity to see full details
   - Navigate to related records (tenant detail, payment detail)

4. **Export Functionality**
   - Export activity history to CSV
   - Export activity history to PDF
   - Email activity reports

5. **Notifications**
   - Desktop notifications for critical activities
   - Mobile push notifications
   - Email digests

6. **Pagination**
   - Load more activities on demand
   - Infinite scroll for older activities

7. **Activity Grouping**
   - Group activities by agent
   - Group activities by time (today, yesterday, this week)

## Security

### Row Level Security (RLS)

The activity feed respects all existing RLS policies:
- Only managers and admins can view audit logs
- Managers can only see activities for agents they manage
- All data access is governed by database-level security

### Data Privacy

- No sensitive information (passwords, tokens) is displayed
- Phone numbers are only shown for authorized users
- Financial amounts are formatted for display only

## Credits

Built using:
- **Supabase Realtime** - Real-time database subscriptions
- **React Query** - Client-side data fetching and caching
- **date-fns** - Human-readable timestamp formatting
- **Lucide React** - Beautiful activity icons
- **Tailwind CSS** - Responsive styling

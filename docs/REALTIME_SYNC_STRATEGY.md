# Real-Time Synchronization Strategy

## Overview
All data changes are instantly synchronized across all devices using Supabase Realtime. When any agent adds a tenant, records a payment, or updates information, all connected devices see the changes immediately without page refresh.

## Architecture

### Database Configuration
All critical tables are configured with `REPLICA IDENTITY FULL` to enable complete row data capture:

```sql
ALTER TABLE public.tenants REPLICA IDENTITY FULL;
ALTER TABLE public.collections REPLICA IDENTITY FULL;
ALTER TABLE public.agents REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
```

### Realtime Subscriptions

#### 1. **Tenant Changes** (`useRealtimeTenants`)
**Scope**: Single agent's tenants
**Filters**: `agent_id=eq.{agentId}`

**Triggered by**:
- New tenant created
- Tenant details updated (landlord, LC1, rent amount)
- Tenant deleted

**Updates**:
- Invalidates `['tenants', agentId]` query
- Invalidates `['tenant', tenantId]` query for specific tenant
- Removes deleted tenants from cache

**Used in**:
- `src/pages/agent/Tenants.tsx` - Tenant list page
- Agent dashboard tenant counts

#### 2. **Collection Changes** (`useRealtimeCollections`)
**Scope**: Single tenant's payments
**Filters**: `tenant_id=eq.{tenantId}`

**Triggered by**:
- Payment recorded
- Payment status updated
- Payment deleted (rare)

**Updates**:
- Invalidates `['collections', tenantId]` query
- Invalidates `['tenant', tenantId]` query (balance changes)

**Used in**:
- `src/pages/agent/TenantDetail.tsx` - Tenant detail page
- Payment history tables

#### 3. **All Tenants Changes** (`useRealtimeAllTenants`)
**Scope**: All tenants across all agents
**No filters** - Manager view

**Triggered by**:
- Any tenant change system-wide
- New tenant by any agent
- Updates by any agent

**Updates**:
- Invalidates all `['tenants']` queries
- Invalidates specific `['tenant', tenantId]` on updates

**Used in**:
- `src/pages/manager/Dashboard.tsx` - Manager overview
- `src/pages/manager/Agents.tsx` - Agent management

#### 4. **All Collections Changes** (`useRealtimeAllCollections`)
**Scope**: All payments across all agents
**No filters** - Manager view

**Triggered by**:
- Any payment recorded system-wide
- Payment updates by any agent

**Updates**:
- Invalidates all `['collections']` queries

**Used in**:
- Manager dashboard analytics
- Manager earnings overview

#### 5. **Agent Profile Changes** (`useRealtimeAgents`)
**Scope**: All agent profiles
**No filters** - System-wide

**Triggered by**:
- Agent portfolio value updates
- Agent earnings updates
- Agent statistics changes (collection rate, active tenants)

**Updates**:
- Invalidates `['agents']` queries
- Invalidates `['agent', agentId]` for specific agent

**Used in**:
- `src/pages/manager/Agents.tsx` - Agent list
- Manager dashboard agent cards

## React Query Integration

### Cache Invalidation Strategy
When realtime events fire, we use React Query's `invalidateQueries` instead of direct cache updates:

```typescript
queryClient.invalidateQueries({ queryKey: ['tenants', agentId] });
```

**Why invalidation instead of direct update?**
- Automatically refetches with latest data
- Handles related data updates (e.g., balance changes with payments)
- Works seamlessly with optimistic updates
- Prevents cache inconsistencies

### Optimistic Updates + Realtime
Realtime subscriptions complement optimistic updates:

1. **User action** → Optimistic update (instant UI)
2. **Server processes** → Database update
3. **Realtime fires** → Cache invalidation
4. **React Query refetches** → Fresh data confirmed

This creates a smooth flow where:
- User sees instant feedback (optimistic)
- Realtime ensures eventual consistency
- Other devices get updates immediately

## Implementation Pattern

### Basic Hook Usage
```typescript
import { useRealtimeTenants } from '@/hooks/useRealtimeSubscription';

function TenantsPage() {
  const [agentId, setAgentId] = useState<string | null>(null);
  
  // Enable realtime for this agent's tenants
  useRealtimeTenants(agentId);
  
  // Use React Query to fetch data
  const { data: tenants } = useQuery({
    queryKey: ['tenants', agentId],
    queryFn: () => fetchTenants(agentId),
  });
  
  return <TenantList tenants={tenants} />;
}
```

### Multi-Level Realtime
For pages with multiple data types:

```typescript
function TenantDetailPage() {
  const { tenantId } = useParams();
  
  // Enable realtime for collections
  useRealtimeCollections(tenantId);
  
  // Also enable tenant updates (landlord, LC1 changes)
  useRealtimeTenants(tenantId);
  
  // Both queries will auto-refresh on realtime events
  const { data: tenant } = useTenantData(tenantId);
  const { data: collections } = useCollectionsData(tenantId);
}
```

## Performance Considerations

### Connection Management
- Each hook creates a single Supabase channel
- Channels are automatically cleaned up on unmount
- No duplicate subscriptions for same data

### Network Efficiency
- Filters reduce unnecessary events (`agent_id=eq.{id}`)
- Only invalidates affected queries
- React Query deduplicates simultaneous refetches

### Offline Handling
- Realtime reconnects automatically when back online
- Optimistic updates work offline (queued for sync)
- Realtime events catch up when reconnected

## Testing Realtime Sync

### Manual Testing Steps

1. **Open two devices/browsers**
   - Device A: Agent view
   - Device B: Manager view or same agent on another device

2. **Test tenant creation**
   - Device A: Create new tenant
   - Device B: Should see tenant appear instantly

3. **Test payment recording**
   - Device A: Record payment on tenant detail page
   - Device B: See balance update in tenant list immediately

4. **Test landlord updates**
   - Device A: Edit landlord information
   - Device B: See changes reflected on tenant detail page

5. **Test cross-agent sync**
   - Device A: Agent 1 adds tenant
   - Device B: Manager sees tenant in system totals instantly

### Console Monitoring
Check browser console for realtime events:
```
Realtime tenant change: {eventType: "INSERT", new: {...}}
Realtime collection change: {eventType: "UPDATE", new: {...}}
```

## Security

### RLS Policies
Realtime respects Row Level Security:
- Agents only receive events for their own tenants
- Managers receive all events (admin access)
- Users can't subscribe to data they don't have access to

### Subscription Filters
Filters are applied server-side:
```typescript
filter: `agent_id=eq.${agentId}`
```
Only matching rows trigger events.

## Troubleshooting

### Events Not Firing
1. Check REPLICA IDENTITY is set: `REPLICA IDENTITY FULL`
2. Verify table is in publication (automatic for Supabase)
3. Check RLS policies allow SELECT on table
4. Ensure subscription filter matches data

### Multiple Refetches
- Expected when multiple queries depend on same data
- React Query automatically deduplicates
- No performance impact

### Delayed Updates
- Typical latency: 50-200ms
- Check network connection quality
- Verify Supabase region proximity

## Future Enhancements

- [ ] Presence indicators (show who's viewing tenant)
- [ ] Conflict resolution for concurrent edits
- [ ] Optimistic UI for realtime events (pre-render)
- [ ] Realtime notifications for overdue tenants
- [ ] Batch updates compression for high-frequency changes
- [ ] Selective field subscriptions (reduce payload size)

## Best Practices

1. **Always clean up subscriptions**
   ```typescript
   return () => {
     supabase.removeChannel(channel);
   };
   ```

2. **Use filters when possible**
   ```typescript
   filter: `agent_id=eq.${agentId}`  // ✅ Filtered
   // vs
   table: 'tenants'  // ❌ Unfiltered (manager only)
   ```

3. **Invalidate related queries**
   ```typescript
   // Payment recorded → invalidate both
   queryClient.invalidateQueries({ queryKey: ['collections', tenantId] });
   queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
   ```

4. **Don't over-subscribe**
   - One subscription per data scope
   - Reuse existing subscriptions when possible
   - Let React Query handle refetching

## Migration Notes

### Pre-Realtime Architecture
**Before**: Manual refresh or page reload to see changes
- Agent adds tenant → other devices don't see it
- Manager needs to refresh to see new payments
- Data feels stale

**After**: Instant synchronization everywhere
- Agent adds tenant → appears on all devices instantly
- Manager sees payments as they're recorded
- Data always fresh, zero perceived lag

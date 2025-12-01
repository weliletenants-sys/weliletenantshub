# Automatic Update System

This document explains how the automatic update system ensures **all devices always run the latest version** of the Welile app automatically after you publish.

## Overview

The app uses a robust multi-layered approach to ensure users always have the latest version:

1. **Version Tracking via version.json** - Server version manifest
2. **Periodic Version Checking** - Checks every 2 minutes + on focus + on reconnect
3. **Automatic Cache Clearing** - Clears all caches when updates detected
4. **Force Reload** - Automatically reloads app with new version
5. **Visual Feedback** - Update indicator + toast notifications

## How It Works

### 1. Version Detection

The `useVersionCheck` hook runs in the App component and:
- Fetches `/version.json` with cache-busting every 2 minutes
- Checks when the user returns to the app (window focus)
- Checks when the device reconnects to the internet
- Compares stored version against server version
- Triggers automatic update flow when versions differ

### 2. Update Flow

When a new version is detected:

```
1. Fetch /version.json (cache-busted)
   ↓
2. Compare with stored version
   ↓
3. If different → Show "🎉 New Update Available!" toast
   ↓
4. Wait 3 seconds (gives user heads-up)
   ↓
5. Clear all browser caches
   ↓
6. Store new version identifier
   ↓
7. Force reload page with cache bypass
   ↓
8. User sees latest version + changelog
```

## Publishing Updates - IMPORTANT! 📢

**When you publish updates via Lovable, follow these steps to trigger automatic updates on all devices:**

### Step 1: Update Version Number (Before Publishing!)

Edit `public/version.json` and increment the version:

```json
{
  "version": "2.0.2",  // ⬅️ CHANGE THIS! Increment version number
  "buildTime": "2025-01-15T12:00:00Z",  // ⬅️ Update timestamp
  "description": "Welile Tenants Hub - [What changed in this version]"
}
```

**Version Format** (Semantic Versioning):
- **Major** (3.0.0): Breaking changes, major redesigns
- **Minor** (2.1.0): New features, no breaking changes  
- **Patch** (2.0.1): Bug fixes, small improvements

### Step 2: Add Version to Database (Optional but Recommended)

For tracking in the Version History page, manually add the new version to the database:

```sql
INSERT INTO public.version_history (version, deployed_at, description, deployed_by)
VALUES ('2.0.2', now(), 'Brief description of changes', '[your-user-id]');
```

Or managers can view and track all deployments in the **Version History** page at `/manager/version-history`.

### Step 3: Publish via Lovable

1. Click **Publish** button (top right on desktop, bottom-right on mobile)
2. Click **Update** in the publish dialog
3. Wait for deployment (usually 1-2 minutes)

### Step 4: Verify Automatic Updates

After publishing:
- All connected users will detect the update **within 2 minutes** automatically
- Users see: "🎉 New Update Available! Applying latest version in 3 seconds..."
- App auto-reloads with new version
- Version adoption is automatically logged to database
- Changelog dialog shows what's new
- **No user action required!** 🎉

## User Experience

### Update Indicator (Visual Feedback)
- Small badge appears bottom-right: "Checking for updates..."
- Spins during version checks
- Provides feedback that app is staying current
- Auto-hides when check completes

### Update Notification
Users see a clear update flow:
1. Toast notification: "🎉 New Update Available!"
2. Description: "Applying latest version in 3 seconds..."
3. 3-second countdown
4. Automatic reload (no button click needed!)
5. Fresh app with all latest changes

### Changelog Dialog
- After update, users see "What's New" dialog automatically
- Shows last 3 version updates
- Helps users understand new features
- Can be dismissed

### 4. PWA Configuration

The PWA is configured with:
- `registerType: "autoUpdate"` - Automatically update service worker
- `skipWaiting: true` - New service worker activates immediately
- `clientsClaim: true` - New service worker takes control immediately
- `cleanupOutdatedCaches: true` - Remove old caches automatically

## User Experience

Users experience updates seamlessly:
- **No manual action required** - Fully automatic
- **Fast detection** - Within 2 minutes or on app focus
- **Clear communication** - Toast notification with countdown
- **Smooth transition** - 3-second warning before reload
- **Preserved state** - Authentication and local data retained
- **Instant reload** - Latest version loads immediately

## Technical Details

### Files Involved
- **`public/version.json`** - Version manifest (UPDATE THIS BEFORE PUBLISHING!)
- `src/hooks/useVersionCheck.ts` - Version checking logic
- `src/components/UpdateIndicator.tsx` - Visual update indicator  
- `src/App.tsx` - Integration and app-wide updates
- `src/data/changelog.ts` - Changelog content for dialog

### Version Storage
- `localStorage.app_version` - Stores current version identifier
- Compared against `version.json` from server
- Updated after successful reload

### Cache Strategy
- All service worker caches cleared on update
- Ensures no stale content persists  
- Forces fresh fetch of all resources
- Prevents version mismatch issues

## For Developers

### Triggering Updates (Checklist ✅)

**Every time you deploy changes:**

1. ✅ **Update `public/version.json`** (increment version number)
2. ✅ **Click Publish** in Lovable
3. ✅ **Wait 1-2 minutes** for deployment  
4. ✅ **Verify** - All devices update automatically within 2 minutes

That's it! The system handles everything else automatically.

### Testing Updates Locally

To test the update flow during development:
1. Change `version` in `public/version.json`
2. Open DevTools Console
3. Watch for logs:
   - `🔄 New version detected!`
   - `✅ App is up to date`
4. App should show toast and reload automatically

### Monitoring Updates

Console logs show:
- `📦 First load - storing version: [version]`
- `✅ App is up to date: [version]`  
- `🔄 New version detected! { server: X, current: Y }`
- `❌ Version check failed: [error]`

### Version Check Triggers

Updates check automatically:
- Every 2 minutes (periodic interval)
- When user returns to app (window focus)
- When internet reconnects (online event)
- On first app load (initial check)

## Best Practices

### Before Every Publish ⚡
- ✅ **Always update version.json first**
- ✅ Test changes in dev environment
- ✅ Update changelog in `src/data/changelog.ts`
- ✅ Use meaningful version descriptions

### Version Bumping Strategy
- **Bug fixes only**: 2.0.1 → 2.0.2 (patch)
- **New features**: 2.0.2 → 2.1.0 (minor)
- **Breaking changes**: 2.1.0 → 3.0.0 (major)

### Communication
- Use clear descriptions in `version.json`
- Update changelog with user-facing changes
- Keep update messages positive and concise
- Highlight key improvements in changelog

## Troubleshooting

### Users Not Receiving Updates

**Problem**: Users report they don't see latest features

**Solutions**:
1. ✅ Verify `version.json` was updated **before** publishing
2. ✅ Check publish completed successfully in Lovable
3. ⏰ Wait full 2 minutes for automatic check cycle
4. 📱 Ask user to close and reopen app (triggers focus check)
5. 🔄 User can manually refresh: Ctrl+Shift+R (desktop) or close/reopen (mobile)

### Version Not Changing

**Problem**: `version.json` shows old version after publish

**Solutions**:
1. Clear your browser cache (you may be seeing cached version)
2. Check published site directly (not localhost)
3. Verify file was saved before clicking Publish
4. Try hard refresh: Ctrl+Shift+R

### Cache Issues

**Problem**: Users see mixed old/new content

**Solutions**:
- Update system **automatically clears all caches** on detection
- If problems persist: Ask user to clear browser data manually
- Last resort: PWA uninstall/reinstall (rare)

### Manual Force Update (User Instructions)

If automatic update fails, users can manually force refresh:
- **Desktop**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- **Mobile**: Close app completely, then reopen
- **PWA**: Uninstall and reinstall from browser (preserves login)

## Edge Cases Handled

The system gracefully handles:

1. **Network failures** → Continues without update, retries later
2. **Cache API unavailable** → Falls back to regular reload
3. **First-time users** → Stores version without triggering update
4. **Offline users** → Checks resume when connection returns
5. **Rapid deployments** → Each check is independent
6. **Concurrent updates** → Latest version always wins
7. **Interrupted updates** → Retry on next check cycle

## Performance

The update system is optimized for efficiency:
- Lightweight JSON fetch (few bytes)
- Background checks don't block UI
- Cache operations are asynchronous  
- 2-minute interval prevents excessive checking
- No impact on app performance or UX

## Security

Version checking follows best practices:
- Cache-busting prevents stale responses (`?v=timestamp`)
- No sensitive data in version identifiers
- Updates respect same-origin policy
- Service worker updates follow browser security model
- HTTPS enforced in production

## Summary 🎯

**The automatic update system ensures:**
- 📱 All devices stay current automatically
- 🔄 Updates happen seamlessly in background
- ⚡ Fast detection (within 2 minutes)
- 💨 No user action required
- 🎉 Users always see latest features and fixes
- 🔒 Secure and reliable update delivery
- 📊 Version adoption tracking via Version History page

**Key Features:**
- **Automatic version checking** every 2 minutes + on focus + reconnect
- **Version adoption tracking** - logs when users update to new versions
- **Version History page** at `/manager/version-history` shows:
  - All deployed versions with dates
  - User adoption rates and percentages
  - Deployment timeline
  - Adopter counts per version

**Just remember one thing:** 
### 🚨 Update `public/version.json` before every publish! 🚨

That's the only manual step needed. Everything else is automatic! ✨

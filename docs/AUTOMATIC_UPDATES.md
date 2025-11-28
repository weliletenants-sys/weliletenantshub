# Automatic Update System

This document explains how the automatic update system ensures all devices always run the latest version of the Welile app.

## Overview

The app uses a multi-layered approach to ensure users always have the latest version:

1. **Version Checking** - Checks for new versions every 2 minutes
2. **Service Worker Updates** - Automatically detects and installs new service worker versions
3. **Automatic Cache Clearing** - Clears all caches when updates are detected
4. **Force Reload** - Automatically reloads the app with the new version

## How It Works

### 1. Version Detection

The `useVersionCheck` hook runs in the App component and:
- Checks for new versions every 2 minutes
- Checks when the user returns to the app (window focus)
- Checks when the device reconnects to the internet
- Compares the server's ETag/Last-Modified headers to detect changes

### 2. Service Worker Updates

The `useServiceWorker` hook:
- Checks for service worker updates every 2 minutes
- Listens for the `updatefound` event
- Automatically triggers cache clearing and reload when updates are detected

### 3. Update Flow

When a new version is detected:

```
1. Version check detects change
   ↓
2. Show "New Version Available" toast (3 seconds)
   ↓
3. Clear all browser caches
   ↓
4. Update stored version identifier
   ↓
5. Force reload page with cache bypass
   ↓
6. User sees latest version
```

### 4. PWA Configuration

The PWA is configured with:
- `registerType: "autoUpdate"` - Automatically update service worker
- `skipWaiting: true` - New service worker activates immediately
- `clientsClaim: true` - New service worker takes control immediately
- `cleanupOutdatedCaches: true` - Remove old caches automatically

## User Experience

Users experience updates seamlessly:
- No manual action required
- 3-second notification before reload
- All changes preserved (local storage, authentication state)
- Instant reload with latest version

## For Developers

### Triggering Updates

When you deploy changes:
1. Frontend changes are built with new timestamps
2. Service worker detects new assets
3. ETag/Last-Modified headers change
4. All connected devices detect the change within 2 minutes
5. Devices automatically update

### Testing Updates

To test the update flow:
1. Deploy a new version
2. Wait up to 2 minutes (or focus/unfocus the browser)
3. Watch the console for "New version detected" logs
4. App should automatically reload with new version

### Debugging

Enable console logs to see:
- Version check attempts: "Checking for service worker updates..."
- New versions detected: "New version detected: [etag]"
- Cache clearing: "All caches cleared for update"
- Service worker state changes

## Version Storage

The app stores version information in:
- `localStorage.app_version` - Current ETag/Last-Modified value
- Service worker cache - Timestamped cached responses
- Build-time constant - `VITE_BUILD_TIME` environment variable

## Edge Cases Handled

1. **Network failures** - Gracefully continues without update
2. **Cache API unavailable** - Falls back to regular reload
3. **First-time users** - Stores version without triggering update
4. **Offline users** - Checks resume when connection returns
5. **Rapid deployments** - Each check is independent

## Performance

The update system is designed to be lightweight:
- HEAD requests for version checks (no body downloaded)
- Background checks don't block user interaction
- Cache operations are asynchronous
- 2-minute interval prevents excessive checking

## Security

- Version checks use cache-busting to prevent stale responses
- No sensitive data in version identifiers
- Updates respect same-origin policy
- Service worker updates follow browser security model

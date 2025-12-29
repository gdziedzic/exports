# DevChef PWA Testing Guide

This guide provides comprehensive instructions for testing the Progressive Web App (PWA) functionality of DevChef.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Service Worker Testing](#service-worker-testing)
3. [Installation Testing](#installation-testing)
4. [Offline Functionality Testing](#offline-functionality-testing)
5. [Update Notification Testing](#update-notification-testing)
6. [Platform-Specific Testing](#platform-specific-testing)
7. [Debug Commands](#debug-commands)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Server Setup

PWAs require HTTPS or localhost. Start a local server:

```bash
# Option 1: Python (recommended)
python -m http.server 8000

# Option 2: Node.js http-server
npx http-server -p 8000

# Option 3: PHP
php -S localhost:8000
```

Access DevChef at: `http://localhost:8000`

### Browser Requirements

- **Chrome/Edge**: Full PWA support (recommended for testing)
- **Firefox**: Service Worker support, limited install UI
- **Safari (iOS 16.4+)**: Full PWA support on iOS/iPadOS
- **Safari (macOS)**: Limited PWA support

---

## Service Worker Testing

### 1. Verify Service Worker Registration

1. Open DevChef in browser
2. Open DevTools (F12)
3. Check Console for:
   ```
   🔧 Initializing PWA...
   ✅ Service Worker registered: http://localhost:8000/
   ```

### 2. Inspect Service Worker Status

**Chrome/Edge DevTools:**
1. Open DevTools > Application tab
2. Navigate to "Service Workers" section
3. Verify:
   - ✅ Service Worker status: "activated and is running"
   - ✅ Scope: `http://localhost:8000/`
   - ✅ Source: `/sw.js`

**Firefox DevTools:**
1. Open DevTools > Application tab (or Storage > Service Workers)
2. Check service worker status

### 3. Test Cache Storage

**Chrome/Edge DevTools:**
1. Application > Cache Storage
2. Verify caches exist:
   - `devchef-v2.6.0-static` (core files)
   - `devchef-v2.6.0-dynamic` (dynamic content)
   - `devchef-v2.6.0-tools` (tool files)
3. Expand each cache to verify files are cached

**Console Command:**
```javascript
// Check cache names
caches.keys().then(names => console.log('Caches:', names))

// Check static cache contents
caches.open('devchef-v2.6.0-static').then(cache =>
  cache.keys().then(keys => console.log('Static files:', keys.length))
)
```

---

## Installation Testing

### Desktop (Chrome/Edge)

#### Test 1: Install Banner Display

1. Open DevChef in browser (not installed)
2. Wait 30 seconds or refresh page
3. **Expected**: Blue install banner appears at top:
   - 📱 Icon
   - "Install DevChef" heading
   - Description text
   - "Install" button
   - Dismiss (×) button

#### Test 2: Install via Banner

1. Click "Install" button on banner
2. **Expected**: Browser install prompt appears
3. Click "Install" in browser prompt
4. **Expected**:
   - App opens in standalone window (no browser UI)
   - Install banner disappears
   - Success notification: "DevChef installed successfully! 🎉"

#### Test 3: Install via Browser Menu

1. Look for install icon in address bar (⊕ or install icon)
2. Click icon → "Install DevChef"
3. Confirm installation
4. **Expected**: Same as Test 2

#### Test 4: Dismiss Banner

1. Click dismiss (×) button
2. **Expected**: Banner slides up and disappears
3. Refresh page
4. **Expected**: Banner does NOT reappear (localStorage flag set)

**Reset dismiss flag:**
```javascript
localStorage.removeItem('pwa-install-dismissed')
// Refresh page to see banner again
```

### Mobile (Android - Chrome)

1. Open DevChef in Chrome
2. Wait for "Add to Home screen" banner/prompt
3. Tap "Add to Home screen" or browser menu > "Install app"
4. **Expected**:
   - Icon added to home screen
   - App name: "DevChef"
   - Opens in fullscreen mode

### iOS/iPadOS (Safari 16.4+)

#### iOS 16.4+ (Native Install Prompt)
1. Open DevChef in Safari
2. Look for Share button action or install prompt
3. Follow system install instructions

#### iOS 16.3 and Earlier (Manual)
1. Open DevChef in Safari
2. Tap Share button (box with arrow)
3. Scroll and tap "Add to Home Screen"
4. Edit name if desired
5. Tap "Add"
6. **Expected**:
   - Icon appears on home screen
   - Opens in standalone mode

**Note:** Install banner won't show on iOS Safari (beforeinstallprompt not supported).

### Firefox

**Note:** Firefox doesn't show install prompts automatically. Installation must be manual.

1. Click address bar or menu
2. Look for install option (may vary)
3. Or enable `dom.webnotifications.serviceworker.enabled` in about:config

---

## Offline Functionality Testing

### Test 1: Full Offline Mode

1. Install DevChef (or open in browser)
2. Use app briefly (open 2-3 tools)
3. **Chrome/Edge DevTools:**
   - Open DevTools > Network tab
   - Check "Offline" checkbox at top
4. **Firefox:**
   - File > Work Offline
5. **Alternative:** Turn off Wi-Fi
6. Refresh page or navigate
7. **Expected**:
   - ✅ App loads completely
   - ✅ All core features work
   - ✅ Recently used tools load
   - ✅ No network errors

### Test 2: Offline Tool Loading

1. Go offline (see Test 1)
2. Try to open a tool not previously loaded
3. **Expected**:
   - If tool was cached: loads successfully
   - If tool not cached: Shows offline message

### Test 3: Network Recovery

1. While offline, try to use app
2. Go back online
3. Refresh page
4. **Expected**:
   - App updates from network
   - New content loads
   - No errors

### Test 4: Cache Inspection

```javascript
// Check what's cached
DevChef.pwa.registration().then(reg => {
  caches.keys().then(names => {
    names.forEach(name => {
      caches.open(name).then(cache => {
        cache.keys().then(keys => {
          console.log(`${name}: ${keys.length} files`)
        })
      })
    })
  })
})
```

---

## Update Notification Testing

### Test 1: Trigger Service Worker Update

1. Install DevChef and use it
2. **Modify sw.js:**
   ```javascript
   // Change version in sw.js
   const CACHE_VERSION = 'devchef-v2.6.1'; // was v2.6.0
   ```
3. Save file
4. In DevChef, wait 60 seconds (auto-update check)
   - **Or force update:**
     ```javascript
     DevChef.pwa.registration().update()
     ```
5. **Expected**: Green update notification appears bottom-right:
   - 🔄 Icon
   - "A new version is available!"
   - "Update" button
   - Dismiss (×) button

### Test 2: Apply Update

1. When update notification appears
2. Click "Update" button
3. **Expected**:
   - Page reloads automatically
   - New service worker activates
   - Old caches cleared
   - Console shows: "🔄 Service Worker controller changed - reloading page"

### Test 3: Dismiss Update

1. When update notification appears
2. Click dismiss (×) button
3. **Expected**: Notification disappears
4. **Note**: Update is still available, refresh manually to apply

### Test 4: Manual Update Check

```javascript
// Force update check
DevChef.pwa.registration().update().then(() => {
  console.log('Update check complete')
})

// Show update notification manually (for testing)
DevChef.pwa.showUpdateNotification()
```

---

## Platform-Specific Testing

### Chrome (Desktop)

**Install:**
- ✅ beforeinstallprompt event
- ✅ Custom install banner
- ✅ Address bar install button
- ✅ Menu > Install DevChef

**Standalone:**
- ✅ No browser UI (address bar, tabs)
- ✅ Custom title bar
- ✅ Window controls

**Shortcuts:**
- ✅ Right-click app icon
- ✅ App shortcuts menu (Quick Actions, Snippets, Insights)

### Edge (Desktop)

Same as Chrome (Chromium-based)

### Chrome (Android)

**Install:**
- ✅ "Add to Home screen" banner
- ✅ Menu > Install app

**Standalone:**
- ✅ Fullscreen mode
- ✅ System status bar (time, battery)
- ✅ No browser UI

**Features:**
- ✅ Splash screen with icon
- ✅ Matches theme color

### Safari (iOS 16.4+)

**Install:**
- ✅ System install prompt (iOS 16.4+)
- ✅ Share > Add to Home Screen (all versions)

**Standalone:**
- ✅ Fullscreen
- ✅ Status bar integration
- ✅ Splash screen

**Limitations:**
- ⚠️ No beforeinstallprompt event (banner won't show)
- ⚠️ Limited service worker features
- ⚠️ No Web Share API

### Safari (macOS)

**Limitations:**
- ⚠️ Limited PWA support
- ⚠️ Can "Add to Dock" but not true PWA
- ⚠️ Service Workers work

### Firefox

**Service Worker:**
- ✅ Full support

**Install:**
- ⚠️ No standard install UI
- ⚠️ Manual installation only
- ⚠️ Limited PWA features

---

## Debug Commands

Use these commands in browser console:

### PWA Status

```javascript
// Get comprehensive PWA status
DevChef.pwa.status()
// Returns:
// {
//   isStandalone: boolean,
//   isInstalled: boolean,
//   serviceWorkerSupported: boolean,
//   serviceWorkerRegistered: boolean,
//   installPromptAvailable: boolean
// }
```

### Service Worker Control

```javascript
// Get service worker registration
DevChef.pwa.registration()

// Force update check
DevChef.pwa.registration().update()

// Unregister service worker
DevChef.pwa.registration().unregister()

// Skip waiting (apply update immediately)
DevChef.pwa.registration().waiting.postMessage({ type: 'SKIP_WAITING' })
```

### Cache Management

```javascript
// Clear all caches
caches.keys().then(names => {
  return Promise.all(names.map(name => caches.delete(name)))
}).then(() => console.log('All caches cleared'))

// Clear specific cache
caches.delete('devchef-v2.6.0-static')

// Get cache size
if ('storage' in navigator && 'estimate' in navigator.storage) {
  navigator.storage.estimate().then(estimate => {
    const usage = (estimate.usage / 1024 / 1024).toFixed(2)
    const quota = (estimate.quota / 1024 / 1024).toFixed(2)
    console.log(`Storage: ${usage} MB / ${quota} MB (${(estimate.usage / estimate.quota * 100).toFixed(1)}%)`)
  })
}
```

### Install Banner Control

```javascript
// Show install banner (if prompt available)
DevChef.pwa.showInstallBanner()

// Hide install banner
DevChef.pwa.hideInstallBanner()

// Reset dismiss flag
localStorage.removeItem('pwa-install-dismissed')

// Check if dismissed
localStorage.getItem('pwa-install-dismissed') === 'true'
```

### Update Notification Control

```javascript
// Show update notification (for testing)
DevChef.pwa.showUpdateNotification()

// Hide update notification
DevChef.pwa.hideUpdateNotification()
```

---

## Troubleshooting

### Service Worker Not Registering

**Problem:** Console shows service worker errors

**Solutions:**
1. Ensure running on localhost or HTTPS
2. Check `/sw.js` file exists and is accessible
3. Clear browser cache and reload
4. Check browser console for specific errors
5. Try hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)

**Verify:**
```javascript
// Check if service workers are supported
console.log('Service Workers supported:', 'serviceWorker' in navigator)
```

### Install Banner Not Showing

**Problem:** No install banner appears

**Reasons:**
1. **Already installed**: Check if app is already installed
2. **Previously dismissed**: Check localStorage
3. **Browser doesn't support**: Safari iOS, Firefox, etc.
4. **PWA criteria not met**: Manifest or SW issue

**Debug:**
```javascript
// Check install status
console.log('Standalone mode:', window.matchMedia('(display-mode: standalone)').matches)
console.log('Install dismissed:', localStorage.getItem('pwa-install-dismissed'))

// Reset and retry
localStorage.removeItem('pwa-install-dismissed')
location.reload()
```

### Offline Mode Not Working

**Problem:** App doesn't load offline

**Solutions:**
1. **Check caches exist:**
   ```javascript
   caches.keys().then(console.log)
   ```
2. **Verify files are cached:**
   ```javascript
   caches.match('/index.html').then(response =>
     console.log('index.html cached:', !!response)
   )
   ```
3. **Check service worker active:**
   ```javascript
   navigator.serviceWorker.ready.then(reg =>
     console.log('SW active:', !!reg.active)
   )
   ```
4. **Clear caches and reload:**
   ```javascript
   caches.keys().then(names =>
     Promise.all(names.map(name => caches.delete(name)))
   ).then(() => location.reload())
   ```

### Update Not Applying

**Problem:** Update notification appears but update doesn't apply

**Solutions:**
1. **Manual reload:** Close all tabs and reopen
2. **Force update:**
   ```javascript
   DevChef.pwa.registration().waiting.postMessage({ type: 'SKIP_WAITING' })
   ```
3. **Unregister and re-register:**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(registrations => {
     registrations.forEach(reg => reg.unregister())
   }).then(() => location.reload())
   ```

### Tools Not Loading Offline

**Problem:** Some tools fail to load offline

**Cause:** Tools not cached yet

**Solution:** Preload all tools:
```javascript
// Prefetch all tools
fetch('/tools/index.json')
  .then(r => r.json())
  .then(tools => {
    DevChef.pwa.registration().active.postMessage({
      type: 'PREFETCH_TOOLS',
      data: { tools }
    })
  })
```

### iOS Safari Issues

**Problem:** Features don't work on iOS

**Known Limitations:**
- No beforeinstallprompt event (install banner won't show)
- Must install via Share > Add to Home Screen
- Limited service worker features
- No Web Share API

**Workaround:**
Display instructions for iOS users:
```javascript
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
if (isIOS) {
  console.log('iOS detected: Install via Share > Add to Home Screen')
}
```

---

## Testing Checklist

Use this checklist to verify all PWA functionality:

### Service Worker
- [ ] Service worker registers successfully
- [ ] Console shows registration confirmation
- [ ] DevTools shows service worker active
- [ ] Caches are created (static, dynamic, tools)
- [ ] Files are cached on first load

### Installation
- [ ] Install banner appears (Chrome/Edge desktop)
- [ ] Install button works
- [ ] Browser install prompt appears
- [ ] App installs successfully
- [ ] App opens in standalone mode
- [ ] Install banner disappears after install
- [ ] Success notification shows
- [ ] Dismiss button hides banner
- [ ] Banner doesn't reappear after dismiss

### Offline Functionality
- [ ] App loads completely offline
- [ ] Core features work offline
- [ ] Previously loaded tools work offline
- [ ] No network errors in console
- [ ] App recovers when going back online

### Updates
- [ ] Update notification appears (after version change)
- [ ] Update button applies update
- [ ] Page reloads after update
- [ ] Old caches are cleared
- [ ] New version is active
- [ ] Dismiss button hides notification

### Platform-Specific
- [ ] Chrome desktop: Full install flow works
- [ ] Edge desktop: Full install flow works
- [ ] Chrome Android: Install and offline work
- [ ] Safari iOS: Manual install works
- [ ] Safari macOS: Service worker works
- [ ] Firefox: Service worker works

### Debug & Monitoring
- [ ] `DevChef.pwa.status()` returns correct info
- [ ] Cache inspection commands work
- [ ] Manual update check works
- [ ] Banner control functions work

---

## Additional Resources

### PWA Testing Tools

- **Lighthouse**: DevTools > Lighthouse > Run PWA audit
- **PWA Builder**: https://www.pwabuilder.com/
- **Workbox Devtools**: Chrome extension for service worker debugging

### Manifest Validation

Check manifest in DevTools:
- Chrome/Edge: Application > Manifest
- Verify all fields are correct
- Check icons load properly
- Test theme color displays

### Service Worker Lifecycle

1. **Register** → Install → Activate → Fetch
2. **Update** → Install (new) → Wait → Activate (when old closes)
3. **skipWaiting()** → Activate immediately

### Best Practices

- Always test on real devices (not just emulator)
- Test on slow/unstable networks
- Test with browser cache disabled
- Test with multiple tabs open
- Test update flow multiple times
- Clear everything and start fresh between tests

---

## Conclusion

This testing guide covers all aspects of DevChef's PWA functionality. Follow the tests systematically to ensure the PWA works correctly across all platforms and scenarios.

For issues not covered here, check:
- Browser console for errors
- DevTools Application/Service Workers panel
- DevChef GitHub Issues: https://github.com/gdziedzic/experiments

**Happy Testing! 🚀**

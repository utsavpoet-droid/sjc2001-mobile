# Notification System — Technical Design Document

**Status:** Design / Pre-implementation
**Author:** Architecture review
**Covers:** Mobile app + Website backend
**For implementation by:** Codex / next engineer

---

## 1. Is This the Best Approach?

Short answer: **Yes, with three adjustments.**

### What's correct in the current design
- Expo Push API is the right choice. It abstracts iOS APNs + Android FCM into one API, handles token format differences, and returns per-token delivery status. No reason to switch.
- `NotificationLog` table is essential. The current on-the-fly activity computation loses state — unread counts reset, items can't be individually marked read, and there's no audit trail.
- Server-side quiet hours is correct. Client-side quiet hours fail when the phone is off, the app is killed, or the user changes timezone.
- Admin broadcast endpoint is the right pattern. A simple POST from the admin panel is all that's needed — no queue UI, no scheduling complexity for v1.

### Three adjustments to the original design

**Adjustment 1 — Don't use a job queue for v1**
The original design implied background job processing. At the scale of a ~300-person reunion app, fire-and-forget with Expo's batching (already implemented in `lib/pushNotifications.ts`) is sufficient. Adding BullMQ or similar adds infrastructure complexity for no benefit yet. Revisit if the app grows beyond 5,000 members.

**Adjustment 2 — Don't fetch 500 member profiles in the contact card**
The current `members/[id].tsx` on mobile already does `getMemberProfiles(token, { page: 1, limit: 500 })` to find one member's profile. This is an O(n) scan for an O(1) lookup. The backend needs a `GET /api/v1/member-profiles/:memberId` endpoint that fetches by memberId directly. This is a prerequisite before scaling notifications.

**Adjustment 3 — Notification preferences should default to all-on**
The `NotificationPreferences` table should be created lazily (only when a user changes a preference), not eagerly on registration. Default is "everything on" — no row in the table means full notifications.

---

## 2. Known Bugs

### Bug 1 — Web Bell Icon: Wrong Scroll Target for Contact Card Notifications

**File:** `app/(member)/member/activity/ActivityClient.tsx`

**Symptom:** Clicking a notification about a comment or like on a contact card navigates to `/legends` but lands at the top of the page instead of scrolling to the specific member card.

**Root cause:**
The `hrefFor()` function generates:
```
/legends#member-${item.entityId}
```
Next.js client-side navigation does not honour fragment anchors (`#hash`) when navigating between pages. The browser's native scroll-to-anchor only fires on same-page hash changes. On cross-page navigation Next.js discards the hash after routing.

The HTML anchor `id="member-123"` exists on the `MemberCard` component, so the target element is present in the DOM — it's just never scrolled to.

**Fix design (do not implement yet):**
Replace hash routing with a query parameter:
```
/legends?scrollTo=123
```
In the legends page (`LegendsClient.tsx`), add a `useEffect` that reads `searchParams.get('scrollTo')` after mount and calls:
```typescript
document.getElementById(`member-${scrollTo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
```
This must fire after the member list has rendered. Use a `setTimeout(fn, 300)` or wait for the `useQuery` data to be non-empty before scrolling.

**The activity API response already has the correct `entityId`** (the Member.id). No backend change is needed — only the frontend routing and scroll logic.

---

### Bug 2 — Web Bell Icon: Wrong Scroll Target for Story Comment Notifications

**File:** `app/(member)/member/activity/ActivityClient.tsx`

**Symptom:** Clicking a notification about a comment on a story navigates to the stories page but does not scroll to or highlight the specific story, let alone the specific comment.

**Root cause:**
Story comment notifications route to `/stories` with no anchor or query param pointing to the specific story. Comments on stories are displayed in a `CommentPanel` modal — there is no URL-addressable way to open a specific story's comment panel from a link.

**Fix design (do not implement yet):**
Two-part fix:

Part A — Route to story with query param:
```
/stories?openStory=${storyId}&focusComments=1
```

Part B — In `StoriesClient.tsx`, after mount:
1. Read `searchParams.get('openStory')` and `searchParams.get('focusComments')`
2. Scroll to the story element: `document.getElementById(`story-${storyId}`)?.scrollIntoView()`
3. If `focusComments=1`, programmatically open the `CommentPanel` for that story

This requires:
- Adding `id={`story-${story.id}`}` to each story card element (currently missing)
- Exposing a way to trigger the CommentPanel open state from outside the component (lift the open state up or use a URL-driven effect)

The activity API already returns `entityId` for story notifications. No backend change needed.

---

### Bug 3 — Android App Crashes on Open

**Status:** Root cause unconfirmed (no crash logs available). Multiple likely causes identified from code audit.

**Likely cause A — Canary SDK versions (highest probability)**
All Expo packages are canary pre-release builds dated 2026-03-27:
```
"expo": "55.0.10-canary-20260327-0789fbc"
```
Canary builds are not production-stable. They can have native module initialization bugs that manifest as crashes on cold start, specifically on Android which has stricter native module loading order requirements.

**Fix design:** Pin to the latest stable Expo SDK 55 release (no `-canary` suffix). Check `expo.dev/changelog` for the stable SDK 55 release date and migrate. This requires a coordinated update of all `expo-*` packages and a new EAS build.

**Likely cause B — GestureHandlerRootView initialization timing**
`GestureHandlerRootView` was recently added to `app-provider.tsx`. If any screen attempts to use a gesture before the provider tree is ready (race condition on Android's JS bridge initialization), it crashes. Android's JS bridge is slower to initialize than iOS.

**Fix design:** Verify `GestureHandlerRootView` wraps the entire tree before any gesture-dependent screen renders. The current placement in `AppProvider` after `hydrate()` resolves should be correct, but add a try/catch around gesture handler initialization.

**Likely cause C — `getMemberProfiles(token, { page: 1, limit: 500 })` OOM on low-RAM Android devices**
The contact card (`members/[id].tsx`) fetches all 500 member profiles to find one, via:
```typescript
const response = await getMemberProfiles(token, { page: 1, limit: 500 });
return response.profiles.find((item) => String(item.user?.memberId) === String(memberId));
```
A 500-record JSON response on a device with <2GB RAM, combined with React re-renders from other queries loading simultaneously, can cause an out-of-memory crash on Android. This is the most likely crash source for users on mid-range Android devices.

**Fix design:** The backend needs `GET /api/v1/member-profiles/by-member/:memberId` — a direct lookup by memberId. The mobile app then makes one targeted request instead of fetching 500 records. Intermediate fix: reduce the limit to 100.

**Likely cause D — `predictiveBackGestureEnabled: false`**
```json
"predictiveBackGestureEnabled": false
```
This flag was set to `false` in `app.json`, which typically means predictive back gesture caused a crash. The underlying cause (likely a navigation stack issue or unhandled back press in a modal) was masked by disabling the feature. On Android 14+, some system gestures still invoke back handling even with this flag, causing crashes if the handler is broken.

**Fix design:** Re-enable `predictiveBackGestureEnabled: true` and fix the underlying navigation issue rather than suppressing it.

**Likely cause E — `NSAllowsArbitraryLoads: true` (iOS only, but relevant)**
```json
"NSAllowsArbitraryLoads": true
```
This is a security misconfiguration that also signals the app may be making HTTP (not HTTPS) requests in some code paths. On Android, HTTP requests to cleartext endpoints are blocked by default in API level 28+. If any API call is made to an `http://` URL on Android, it will throw a `CLEARTEXT_NOT_PERMITTED` exception which crashes the network layer.

**Fix design:** Audit all URL construction in `lib/api/bases.ts` and ensure all production URLs use `https://`. Remove `NSAllowsArbitraryLoads` from production builds.

---

## 3. Cellular Network Performance Analysis

### Current state: not production-ready for cellular

Three specific patterns will cause visible degradation on 4G/LTE and severe degradation on 3G:

---

### Issue P1 — Members directory loads 500+ records on open (Critical)

**File:** `src/app/(member)/(tabs)/members/index.tsx`

```typescript
getMembersPage({ page: 1, limit: 500 })  // ← entire directory
getBulkEngagement('member', allMemberIds) // ← engagement for all 500
```

**On 4G LTE:** ~800ms–1.5s first load, acceptable but noticeable
**On 3G:** 4–8 seconds, user will see spinner and may abandon
**On spotty cellular:** Request may timeout, leaving the screen in a loading state with no error message

**Design fix (do not implement):**
- Default `limit` to 30
- Implement infinite scroll using `FlatList`'s `onEndReached` to fetch the next page
- Load engagement data only for the currently visible 30, not all 500
- Show a skeleton loader for the first 12 items immediately (from cache if available)

---

### Issue P2 — No request timeout on any API call

**File:** `src/lib/api/client.ts`

```typescript
const res = await fetch(url, options);
```

No `AbortController` or `signal` is passed to any `fetch` call. On a cellular connection that drops mid-request (tunnel, elevator, underground), the fetch will hang indefinitely. React Query's default timeout is also not set. The user sees an infinite spinner with no way to retry.

**Design fix (do not implement):**
Add a 15-second timeout to all API calls:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);
const res = await fetch(url, { ...options, signal: controller.signal });
clearTimeout(timeout);
```
Catch `AbortError` separately and show a "Request timed out — tap to retry" message.

---

### Issue P3 — Image loading has no size constraints or progressive loading

**Files:** Multiple screens using `expo-image`

Photos from the gallery and profile are served via the `/api/img?v=...` proxy at their **original resolution**. A photo uploaded at 4000×3000px (DSLR or iPhone 14 Pro) will be downloaded at full resolution on a phone screen that displays it at 390×520px. On cellular, this is 3–8MB per image instead of 50–150KB.

**Design fix (do not implement):**
The backend image proxy (`app/api/img/route.ts`) needs to accept `?w=800&q=75` resize parameters using the existing `sharp` dependency (already installed). The mobile app appends width/quality params to all image URLs based on display size:
```
/api/img?v=TOKEN&w=800&q=75   ← mobile gallery thumbnail
/api/img?v=TOKEN&w=1200&q=85  ← lightbox full view
/api/img?v=TOKEN&w=200&q=70   ← avatar / thumbnail
```
`expo-image` handles progressive JPEG display natively — images appear immediately in low resolution and sharpen as bytes arrive. This requires both backend (resize) and mobile (URL construction) changes.

---

### Issue P4 — No offline state handling

There is no detection or UI for when the device is offline. If the app opens with no connection:
- All queries fail silently after 1 retry
- Screens show blank content or permanent spinners
- No "You're offline" message

React Query's `refetchOnReconnect: true` is set (good), meaning queries will retry when connection returns. But the UX gap is the period between going offline and reconnecting — the user doesn't know why content isn't loading.

**Design fix (do not implement):**
Use `@react-native-community/netinfo` to detect connection state. When offline, show a subtle banner: "You're offline — showing cached content". React Query's cache is already in memory, so previously loaded screens show their last data automatically. Only new navigations to uncached screens need the banner.

---

### Issue P5 — No stale-while-revalidate tuning for heavy screens

Current config: `staleTime: 60_000` (1 minute) for ALL queries globally.

The gallery album list, members directory, and stories feed all refetch in the background every 60 seconds while the app is in the foreground. On cellular, this wastes data and slows the UI. These are not real-time feeds — stories are posted a few times a day, gallery albums even less frequently.

**Design fix (do not implement):**

| Screen | Recommended staleTime |
|---|---|
| Activity feed / notification count | 30 seconds |
| Stories feed | 3 minutes |
| Members directory | 10 minutes |
| Gallery album list | 15 minutes |
| Album photo detail | 30 minutes (photos don't change) |
| Auth/session | 0 (always fresh) |
| App config / feature flags | 1 hour |

Set these per-query, not globally. The React Query `queryClient` global default can stay at 60s as a safe fallback.

---

## 4. Notification System — Complete Implementation Plan

### 4.1 Backend Changes Required

#### Step 1 — Database: Add NotificationLog table
```prisma
model NotificationLog {
  id              Int        @id @default(autoincrement())
  recipientUserId Int
  recipientUser   MemberUser @relation(fields: [recipientUserId], references: [id], onDelete: Cascade)
  type            String     // see NotificationType enum below
  title           String
  body            String
  entityType      String?    // "story" | "gallery_album" | "poll" | "member" | "news" | "comment"
  entityId        Int?
  deepLink        String?    // "sjc2001://stories/42"
  isRead          Boolean    @default(false)
  pushSent        Boolean    @default(false)
  pushFailed      Boolean    @default(false)
  sentAt          DateTime   @default(now())

  @@index([recipientUserId, isRead])
  @@index([recipientUserId, sentAt])
}

model NotificationPreferences {
  id             Int        @id @default(autoincrement())
  memberUserId   Int        @unique
  memberUser     MemberUser @relation(fields: [memberUserId], references: [id], onDelete: Cascade)
  disabledTypes  String     @default("")  // CSV of muted NotificationType values
  quietHoursStart Int?      // 0-23
  quietHoursEnd   Int?      // 0-23
  updatedAt      DateTime   @updatedAt
}
```

**NotificationType enum values** (stored as strings in DB):
```
STORY_COMMENT
STORY_REACTION
STORY_MENTION
COMMENT_MENTION
MEMBER_REACTION
MEMBER_COMMENT
GALLERY_ALBUM_NEW
GALLERY_PHOTO_REACTION
POLL_NEW
NEWS_NEW
BROADCAST
```

#### Step 2 — Refactor lib/pushNotifications.ts

Replace the scattered `notifyX()` functions with a single dispatch function. Maintain the existing functions as thin wrappers for backward compatibility during migration.

```typescript
// NEW core function
async function sendNotification(params: {
  type: string;
  recipientUserIds: number[];   // empty array = broadcast to all
  excludeUserIds?: number[];
  title: string;
  body: string;
  entityType?: string;
  entityId?: number;
  deepLink?: string;
}): Promise<void>

// Internal flow:
// 1. Resolve recipients (all active users if broadcast, or specific IDs)
// 2. Filter out excludeUserIds
// 3. For each recipient: check NotificationPreferences (skip if type disabled)
// 4. Check quiet hours (skip if in quiet window)
// 5. Write NotificationLog records (batch insert)
// 6. Collect push tokens for recipients who have tokens
// 7. Send to Expo Push API in batches of 100
// 8. On DeviceNotRegistered response: delete token, mark log pushFailed=true
// 9. On success: mark log pushSent=true
```

#### Step 3 — Add missing notification triggers

Wire up notifications for these currently-missing events:

**In `app/api/reactions/route.ts`:**
```typescript
// Add after existing story reaction:
if (entityType === "member") {
  // Notify the member whose card was liked
  notifyMemberReaction(entityId, reactorName, memberUserId);
}
if (entityType === "gallery_photo") {
  // Notify members tagged in this photo
  notifyPhotoReaction(entityId, reactorName, memberUserId);
}
```

**In `app/api/comments/route.ts`:**
```typescript
// Add after existing story comment:
if (entityType === "member") {
  // Notify the member whose card received a comment
  notifyMemberComment(entityId, commenterName, memberUserId, mentionedMemberIds);
}
```

**In `app/api/news/route.ts` (admin creates news):**
```typescript
notifyNewsPublished(news.id, news.title);
```

#### Step 4 — New API endpoint: direct member profile lookup

**New route:** `GET /api/v1/member-profiles/by-member/[memberId]/route.ts`

This fixes the O(n) scan bug and the Android OOM crash:
```
GET /api/v1/member-profiles/by-member/123
Authorization: Bearer {token}

Response: { success: true, data: MemberProfileDto | null }
```

#### Step 5 — New API endpoints: notification management

```
GET  /api/v1/notifications?page=1&limit=20    → paginated NotificationLog for current user
POST /api/v1/notifications/read               → body: { ids: number[] } or { all: true }
GET  /api/v1/notifications/preferences        → fetch NotificationPreferences
PUT  /api/v1/notifications/preferences        → update preferences
```

#### Step 6 — New API endpoint: admin broadcast

```
POST /api/admin/notifications/broadcast
Authorization: Admin session

Request:
{
  title: string        (max 65 chars)
  body: string         (max 240 chars)
  deepLink?: string    optional
  testMode?: boolean   sends only to the admin's own devices
}

Response:
{
  success: true,
  data: { sent: number, failed: number }
}
```

#### Step 7 — Admin UI panel (website)

New page: `app/admin/notifications/page.tsx`

Design:
```
┌─────────────────────────────────────────────────────────┐
│  Push Notifications Broadcast              Admin only    │
├─────────────────────────────────────────────────────────┤
│  Title (65 chars max)                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Message (240 chars max)                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Deep Link (optional)                                   │
│  ○ None                                                 │
│  ○ Reunion Schedule     → sjc2001://silver-jubilee      │
│  ○ Gallery              → sjc2001://gallery             │
│  ○ Polls                → sjc2001://polls               │
│  ○ Custom               [____________________________]  │
│                                                         │
│  Recipients                                             │
│  ● Send to all members                                  │
│  ○ Test only (just my device)                           │
│                                                         │
│  [ Send test notification ]   [ Send to everyone → ]   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Recent Broadcasts                                      │
│  ────────────────────────────────────────────────────── │
│  Apr 1  "Registration closes Friday"   312 sent  0 fail │
│  Mar 28 "New photos from the reunion"  298 sent  2 fail │
└─────────────────────────────────────────────────────────┘
```

Requires: confirm dialog before "Send to everyone" with member count shown.

---

### 4.2 Mobile Changes Required

#### Step 1 — Install expo-notifications

```bash
npx expo install expo-notifications
```

Add to `app.json` plugins:
```json
{
  "plugins": [
    ["expo-notifications", {
      "icon": "./assets/notification-icon.png",
      "color": "#E8845A",
      "sounds": ["./assets/notification.wav"]
    }]
  ]
}
```

#### Step 2 — Create NotificationManager provider

New file: `src/providers/notification-provider.tsx`

```
Responsibilities:
1. On auth state → user (login):
   a. Call Notifications.requestPermissionsAsync()
   b. If granted: call Notifications.getExpoPushTokenAsync()
   c. POST /api/v1/push/register with token
   d. Store token in SecureStore key "push_token"

2. On auth state → null (logout):
   a. Read token from SecureStore
   b. POST /api/v1/push/unregister
   c. Clear SecureStore key "push_token"

3. Foreground listener (addNotificationReceivedListener):
   a. Show in-app toast banner
   b. Invalidate relevant React Query cache key

4. Tap listener (addNotificationResponseReceivedListener):
   a. Read data.deepLink from notification payload
   b. router.push(deepLink)
   c. POST /api/v1/notifications/read with notification log ID

5. Badge management:
   a. On activity query success: set app badge count to unseen count
   b. On activity screen open: clear badge to 0
```

Place `NotificationProvider` inside `AppProvider`, wrapping children after `GestureHandlerRootView`.

#### Step 3 — In-app toast banner component

New file: `src/components/ui/notification-toast.tsx`

```
Visual design:
┌──────────────────────────────────────────┐
│  🔔  Rajan liked your story             │  ← slides down from top
│       "Memories from the trip..."  now  │  ← auto-dismiss in 4s
└──────────────────────────────────────────┘

Behaviour:
- Position: absolute, top: safeAreaInsets.top + 8
- Animation: translateY from -100 to 0 (spring, damping 20)
- Auto-dismiss: withDelay(4000, translateY back to -100)
- Tappable: calls router.push(deepLink) + dismiss
- Swipe up: dismiss immediately
- Queue: if second notification arrives while first is showing,
  first completes, second shows after 300ms gap
- Max 1 toast visible at a time
```

#### Step 4 — Deep link routing verification

All deep links must be verified end-to-end. The `sjc2001://` scheme is registered in `app.json`. Expo Router handles URL scheme resolution via the file-based router.

| Deep Link | Route File | Status |
|---|---|---|
| `sjc2001://stories/42` | `(member)/stories/[id].tsx` | ✅ Exists |
| `sjc2001://gallery/7` | `(member)/gallery/[id].tsx` | ✅ Exists |
| `sjc2001://polls` | `(member)/polls/index.tsx` | ✅ Exists |
| `sjc2001://directory/5` | `(member)/members/[id].tsx` | ✅ Exists |
| `sjc2001://news/3` | `(member)/news/[id].tsx` | ⚠️ Route registered in _layout, screen file needed |
| `sjc2001://silver-jubilee` | `(member)/silver-jubilee/index.tsx` | ✅ Exists |
| `sjc2001://activity` | `(member)/activity/index.tsx` | ✅ Exists |

Only `news/[id].tsx` screen file needs to be created.

#### Step 5 — Activity screen upgrade

Update `src/app/(member)/activity/index.tsx`:
- Each item becomes tappable → `router.push(item.deepLink)`
- Items show an unread blue dot when `isNew: true`
- "Mark all read" button in header
- Driven by `GET /api/v1/notifications` (new endpoint) instead of `GET /api/member/activity`
- The old activity endpoint remains as fallback

#### Step 6 — Notification settings in Settings screen

Add a new section to `src/app/(member)/settings/index.tsx`:

```
NOTIFICATIONS
─────────────────────────────
Push notifications      ● On

NOTIFY ME WHEN
─────────────────────────────
Story likes             ● On
Story comments          ● On
@mentions               ● On
Card likes              ● On
Card comments           ● On
New gallery albums      ● On
New polls               ● On
News articles           ● On
Announcements           ● On

QUIET HOURS
─────────────────────────────
Silence from   10 pm → 8 am  [Edit]
```

Backed by `GET/PUT /api/v1/notifications/preferences`.

---

## 5. Security Fixes (Pre-release Blockers)

These must be fixed before any public release:

### Fix S1 — Remove NSAllowsArbitraryLoads from production builds

**File:** `app.json`

Current:
```json
"NSAppTransportSecurity": {
  "NSAllowsArbitraryLoads": true,
  "NSAllowsLocalNetworking": true
}
```

Required for production:
```json
"NSAppTransportSecurity": {
  "NSAllowsLocalNetworking": true
}
```

Move the `NSAllowsArbitraryLoads` to a dev-only `app.config.js` override, gated by `process.env.APP_ENV === 'development'`.

### Fix S2 — Migrate from canary to stable Expo SDK

All packages with `-canary-` in their version must be pinned to stable releases before EAS Production build. Use `npx expo install --fix` after updating the base `expo` package version to the latest stable.

---

## 6. Performance Fixes (Pre-release Blockers)

### Fix P1 — Replace 500-member bulk fetch in contact card

**File:** `src/app/(member)/members/[id].tsx` and `src/app/(member)/profile/index.tsx`

Replace:
```typescript
const response = await getMemberProfiles(token, { page: 1, limit: 500 });
return response.profiles.find((item) => String(item.user?.memberId) === String(memberId));
```

With:
```typescript
return getMemberProfileByMemberId(token, memberId);
// → GET /api/v1/member-profiles/by-member/:memberId
```

This requires the new backend endpoint from Step 4 above.

### Fix P2 — Add request timeout to API client

**File:** `src/lib/api/client.ts`

Add 15-second `AbortController` timeout to all fetch calls. Expose a `TimeoutError` class distinct from network errors so the UI can show "Request timed out — tap to retry" vs generic "Something went wrong".

### Fix P3 — Paginate members directory

**File:** `src/app/(member)/(tabs)/members/index.tsx`

Change `limit: 500` → `limit: 30`. Add `onEndReached` handler to `FlatList` that increments page and appends results. Load engagement data only for the current page's member IDs. This reduces initial payload from ~2MB to ~150KB.

### Fix P4 — Image resizing via proxy

**File:** `app/api/img/route.ts` (website)

Add `?w=` and `?q=` query parameters. Use the already-installed `sharp` dependency to resize before streaming. The mobile app appends these params based on display width:
- Thumbnail: `?w=400&q=70`
- Card view: `?w=800&q=80`
- Lightbox: `?w=1200&q=85`

---

## 7. Implementation Order for Codex

Implement strictly in this order. Each phase is independently testable and deployable.

### Phase 0 — Security & crash fixes (do first, no feature risk)
1. Remove `NSAllowsArbitraryLoads` from production `app.json` / `app.config.js`
2. Update Expo packages from canary to stable
3. Re-enable `predictiveBackGestureEnabled: true` and fix underlying navigation issue
4. Add 15-second timeout to API client

### Phase 1 — Backend data model (no UI changes)
1. Add `NotificationLog` table + migration
2. Add `NotificationPreferences` table + migration
3. Refactor `sendNotification()` core function (backward compat wrappers preserved)
4. Add `GET /api/v1/member-profiles/by-member/:memberId` endpoint

### Phase 2 — Missing backend notification triggers
1. Member card reaction notification
2. Member card comment notification
3. News article published notification
4. Wire all three through `sendNotification()` with `NotificationLog` writes

### Phase 3 — New notification API endpoints
1. `GET/POST /api/v1/notifications` (list + mark read)
2. `GET/PUT /api/v1/notifications/preferences`
3. `POST /api/admin/notifications/broadcast`
4. Admin UI panel (website)

### Phase 4 — Mobile notification lifecycle
1. Install `expo-notifications`
2. Build `NotificationManager` provider (permissions + token register/unregister + listeners)
3. Build in-app toast banner component
4. Wire foreground listener → toast
5. Wire tap listener → deep-link router

### Phase 5 — Mobile performance fixes
1. Replace 500-member fetch with targeted endpoint (`/by-member/:memberId`)
2. Paginate members directory (limit 30, infinite scroll)
3. Per-query staleTime tuning

### Phase 6 — Web bug fixes
1. Fix activity bell → contact card routing (fragment → query param + scroll)
2. Fix activity bell → story routing (add story anchor IDs + open CommentPanel from URL)

### Phase 7 — User controls
1. Notification settings UI in mobile Settings screen
2. Quiet hours UI + backend enforcement
3. Activity screen upgrade (tap-to-navigate, unread dots, mark-all-read)

### Phase 8 — Image performance (last, requires most coordination)
1. Backend image proxy resize support (`?w=`, `?q=` params)
2. Mobile URL construction with display-size params
3. Progressive loading via `expo-image` `placeholder` prop

---

## 8. Testing Checklist (for Codex)

### Notification delivery tests
- [ ] Story comment → story author receives push
- [ ] Story reaction → story author receives push
- [ ] @mention in story → mentioned member receives push
- [ ] @mention in comment → mentioned member receives push
- [ ] Member card like → member receives push
- [ ] Member card comment → member receives push
- [ ] New gallery album → all members except creator receive push
- [ ] New poll → all members except creator receive push
- [ ] News published → all members receive push
- [ ] Admin broadcast → all members receive push
- [ ] Self-action → no self-notification sent
- [ ] Muted type → notification suppressed per preferences
- [ ] Quiet hours → notification suppressed, NOT sent the next morning (simply skipped)
- [ ] `DeviceNotRegistered` response → token deleted from DB, no crash

### Deep link tests
- [ ] `sjc2001://stories/42` → opens Stories tab, navigates to story 42
- [ ] `sjc2001://gallery/7` → opens Gallery tab, navigates to album 7
- [ ] `sjc2001://polls` → opens Polls screen
- [ ] `sjc2001://directory/5` → opens Members tab, navigates to member 5
- [ ] `sjc2001://news/3` → opens news article 3
- [ ] `sjc2001://activity` → opens Activity screen
- [ ] App killed → tap push → app opens → navigates to correct screen
- [ ] App backgrounded → tap push → app foregrounds → navigates to correct screen
- [ ] App in foreground → notification arrives → toast shows → tap → navigates

### Performance tests
- [ ] Members directory loads first 30 in <2s on 3G (throttled in Chrome DevTools or Android emulator)
- [ ] Gallery album with 40 photos loads in <3s on 3G
- [ ] API call timeout after 15 seconds shows retry prompt
- [ ] App works offline (shows cached data, shows offline banner)
- [ ] 4G cellular: no dropped frames during scroll (FlatList `windowSize`, `maxToRenderPerBatch` tuned)

### Web routing tests
- [ ] Bell icon → member card like → lands on correct member card, scrolled into view
- [ ] Bell icon → member card comment → lands on correct member card, comment panel open
- [ ] Bell icon → story comment → lands on correct story, comment panel open
- [ ] Bell icon → @mention in story → lands on correct story

---

## 9. Files to Create / Modify Summary

### Website (sjc2001-website)
| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `NotificationLog`, `NotificationPreferences` models |
| `prisma/migrations/` | New migration for above |
| `lib/pushNotifications.ts` | Refactor to `sendNotification()` core, keep existing wrappers |
| `app/api/v1/member-profiles/by-member/[memberId]/route.ts` | New endpoint |
| `app/api/v1/notifications/route.ts` | New: list + mark read |
| `app/api/v1/notifications/preferences/route.ts` | New: get/put preferences |
| `app/api/admin/notifications/broadcast/route.ts` | New: admin broadcast |
| `app/admin/notifications/page.tsx` | New: admin UI panel |
| `app/api/reactions/route.ts` | Add member + photo reaction notifications |
| `app/api/comments/route.ts` | Add member comment notification |
| `app/api/news/route.ts` | Add news published notification |
| `app/(member)/member/activity/ActivityClient.tsx` | Fix routing: fragment → query param |
| `app/stories/StoriesClient.tsx` | Fix routing: add anchor IDs + URL-driven panel open |
| `app/legends/LegendsClient.tsx` | Fix routing: add scroll-to-member on query param |

### Mobile (sjc2001-mobile)
| File | Action |
|---|---|
| `app.json` | Remove `NSAllowsArbitraryLoads`, re-enable predictive back |
| `src/providers/notification-provider.tsx` | New: notification lifecycle manager |
| `src/providers/app-provider.tsx` | Wrap with NotificationProvider |
| `src/components/ui/notification-toast.tsx` | New: in-app toast banner |
| `src/features/push/api/push-api.ts` | Add token registration helpers |
| `src/app/(member)/activity/index.tsx` | Upgrade: tap-to-navigate, unread dots |
| `src/app/(member)/settings/index.tsx` | Add notification preferences section |
| `src/app/(member)/news/[id].tsx` | New: news article screen |
| `src/app/(member)/members/[id].tsx` | Replace 500-member fetch with targeted endpoint |
| `src/app/(member)/profile/index.tsx` | Replace 500-member fetch with targeted endpoint |
| `src/app/(member)/(tabs)/members/index.tsx` | Paginate: limit 30, infinite scroll |
| `src/lib/api/client.ts` | Add 15-second AbortController timeout |
| `src/lib/api/bases.ts` | Audit all URLs for HTTPS |
| `src/hooks/use-notification-preferences.ts` | New: preferences hook |
| `src/features/content/api.ts` | Add `getMemberProfileByMemberId()` |

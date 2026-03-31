# SJC 2001 Mobile App — Enhancement Plan

> **Living document.** Reference this at the start of every coding session to orient yourself.
> Update the status column as work progresses.

---

## Ground Rules

- **Members only.** No admin tools, admin APIs, or admin UI in this app ever.
- **Website first.** Never break the Next.js backend (`sjc2001-website`). Mobile changes must only consume existing member-role APIs.
- **One feature per session.** Read only files relevant to the current feature. Commit after each working feature.
- **No new major dependencies** unless absolutely necessary. `react-native-reanimated`, `react-native-gesture-handler`, and `expo-blur` are all already installed — use them.

---

## Session Tracker

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Gallery lightbox (tap to fullscreen, swipe, pinch-zoom) | 🟡 In Progress | See Session 1 below |
| 2 | Haptic feedback throughout app | ⬜ Pending | `expo-haptics` already in SDK |
| 3 | Profile "Then & Now" layout + smart aspect ratios | ⬜ Pending | See Profile Design below |
| 4 | Native image picker for profile photos | ⬜ Pending | `expo-image-picker` needed |
| 5 | Double-tap to react on photos in lightbox | ⬜ Pending | Reaction API already exists |
| 6 | Native share from lightbox | ⬜ Pending | `expo-sharing` + `expo-media-library` |
| 7 | Color system + font upgrade | ⬜ Pending | See Design System below |
| 8 | Account tab redesign | ⬜ Pending | After design system is in |
| 9 | Gallery album list redesign | ⬜ Pending | After design system is in |
| 10 | Members directory redesign | ⬜ Pending | After design system is in |

---

## Session 1 — Gallery Lightbox

### Problem
Photos in the album detail screen (`gallery/[id].tsx`) are static — wrapped in a non-interactive `Card` with a fixed 260px height. No tap handler, no fullscreen view, no pinch-to-zoom.

### Files to touch
- `src/app/(member)/(tabs)/gallery/[id].tsx` — add Pressable + pass index to viewer
- `src/app/(member)/(tabs)/gallery/_lightbox.tsx` (**new**) — fullscreen viewer modal

### Approach
- Wrap each photo in `<Pressable>` — on tap, open lightbox modal via `router.push` with `?photo=index`
- Lightbox is a new screen rendered as a transparent modal (stack presentation)
- Pinch-to-zoom: `react-native-gesture-handler` PinchGestureHandler + `react-native-reanimated` animated scale
- Swipe left/right: FlatList with `pagingEnabled` for photo navigation
- Swipe down to dismiss: pan gesture + spring animation back or close
- Preload adjacent images (previous + next) using `expo-image` prefetch
- Top bar: `X of N` counter + close button (fades out after 3s)
- Bottom bar: photo caption if available + tagged classmate names (read-only from PhotoTag data)

### Performance notes
- Black background only — no blur on Android
- All animations on UI thread via reanimated worklets
- `expo-image` handles caching automatically

---

## Session 2 — Haptic Feedback

### Files to touch
- `src/components/ui/primitives.tsx` — PrimaryButton, GhostButton
- `src/app/(member)/(tabs)/gallery/_lightbox.tsx` — tap to like, swipe dismiss
- `src/features/content/api.ts` — reaction toggle (add haptic on success)

### Approach
- `import * as Haptics from 'expo-haptics'`
- Button press: `Haptics.impactAsync(ImpactFeedbackStyle.Light)`
- Like/reaction: `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`
- Lightbox open: `Haptics.impactAsync(ImpactFeedbackStyle.Light)`
- Swipe dismiss: `Haptics.notificationAsync(NotificationFeedbackType.Success)`
- Error states: `Haptics.notificationAsync(NotificationFeedbackType.Error)`

---

## Session 3 — Profile "Then & Now"

### Problem
`profile/index.tsx` is a basic read-only layout. School photo + current photo are small side-by-side cards. Family photos are a flat 3-photo grid. No storytelling, no aspect ratio handling, no emotional design.

### Files to touch
- `src/app/(member)/profile/index.tsx` — full redesign
- Reuse lightbox from Session 1 for tappable family photos

### Design: Vertical Scroll Story

```
┌─────────────────────────────┐
│  [Gradient hero banner]     │  ← expo-linear-gradient, static
│  Name — Playfair Display    │
│  Title / role               │
│  [Avatar, gold border ring] │
└─────────────────────────────┘

  ──── THEIR STORY ────

┌─────────────────────────────┐
│  " Personal message here "  │  ← Quote card, italic, serif font
└─────────────────────────────┘

  ──── THEN · 2001 ────

[ School photo — smart aspect ratio ]
  Portrait → 3:4 container
  Landscape → 16:9 container
  Caption: "St. Joseph's College, 2001"

  ──── NOW · 2025 ────

[ Current photo — smart aspect ratio ]

  ──── FAMILY ────

[ 1 photo → full width ]
[ 2 photos → 50/50 side by side ]
[ 3 photos → 1 large left + 2 stacked right ]
All tappable → lightbox
```

### Smart aspect ratio logic
- Detect via `Image.getSize()` or `onLoad` event `{ width, height }`
- Portrait (height > width): container height = containerWidth * (h/w), capped at screen height * 0.75
- Landscape (width > height): container height = containerWidth * (9/16)
- `resizeMode="cover"` always — never letterbox

### Entry animations
- Sections fade+translateY up as they scroll into view (reanimated `useScrollViewOffset`)
- Play once, not looping

---

## Session 4 — Native Image Picker

### Problem
Edit profile (`profile/edit.tsx`) currently accepts URL strings only. Users can't upload photos from their camera roll.

### Files to touch
- `src/app/(member)/profile/edit.tsx` — replace URL inputs with image pickers
- Uses existing upload API: `postUploadPresign()` or `postUploadMultipart()`

### New dependency needed
- `expo-image-picker` (official Expo module, safe to add)

### Approach
- Replace each URL text input with a tappable image preview card
- On tap: `ImagePicker.launchImageLibraryAsync` with crop enabled
- On selection: upload via presign URL → store returned URL in form state
- Show upload progress indicator

---

## Session 5 — Double-Tap to React

### Files to touch
- `src/app/(member)/(tabs)/gallery/_lightbox.tsx`

### Approach
- Wrap photo in `TapGestureHandler` with `numberOfTaps={2}`
- On double-tap: call `postReactionToggle` (already in API layer)
- Animate a heart burst at tap location (reanimated `withSequence`)
- Haptic: medium impact

---

## Session 6 — Native Share from Lightbox

### New dependencies needed
- `expo-sharing` (official Expo module)
- `expo-file-system` (likely already in SDK)

### Approach
- Download image to temp file via `expo-file-system`
- Call `Sharing.shareAsync(localUri)`
- Long press in lightbox triggers share sheet

---

## Design System (Session 7+)

### Color Tokens — Dark Mode

| Token | Value |
|-------|-------|
| background | `#0D0A08` |
| surface | `#1A1410` |
| surface-raised | `#251E18` |
| accent-primary | `#E8845A` |
| accent-secondary | `#F5C071` |
| text-primary | `#F5EFE7` |
| text-secondary | `#A89A8C` |
| text-muted | `#5C5048` |
| glass-bg | `rgba(255,245,235,0.06)` |
| glass-border | `rgba(255,245,235,0.12)` |

### Typography
- Display / Hero: `Playfair_Display_700Bold` (Google Fonts via `@expo-google-fonts/playfair-display`)
- Body / UI: `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold` (via `@expo-google-fonts/inter`)

### Component upgrades
- Card: glass background + glass border + warm glow shadow
- PrimaryButton: gradient fill (`expo-linear-gradient`)
- Tab bar: floating pill, translucent, spring animation on switch

---

## Key Architecture Decisions (Don't Revisit)

| Decision | Choice | Reason |
|----------|--------|--------|
| Lightbox implementation | Custom (reanimated + gesture-handler) | Already installed; no bloat |
| Aspect ratio detection | `onLoad` event `{ source: { width, height } }` | Zero deps |
| Blur effects | `expo-blur` on iOS only; plain dark surface on Android | Android perf |
| Animated gradients | Static gradients only; animate opacity/scale not colors | Perf |
| Masonry grid | Rejected — use 2-column fixed-ratio grid | Layout stability |
| Ken Burns | Rejected — plays once on mount or dropped | Battery |
| Admin features | Never in mobile app | Members-only product |

---

## API Reference (Member-Role Only)

| Feature | Endpoint |
|---------|----------|
| Gallery albums | `GET /api/gallery` |
| Album photos | `GET /api/gallery/:id` |
| Member profile (own) | `GET/PUT /api/member-profile` |
| Member profiles (directory) | `GET /api/member-profiles` |
| Member detail | `GET /api/members/:id` |
| Member tagged photos | `GET /api/members/:id/photos` |
| Stories | `GET/POST /api/stories` |
| Comments | `GET/POST /api/comments` |
| Reactions (toggle) | `POST /api/reactions` |
| Polls | `GET /api/polls`, `POST /api/polls/:id/vote` |
| Push register | `POST /api/v1/push/register` |
| App config | `GET /api/v1/app-config` |
| Auth | `POST /api/v1/auth/mobile/login|refresh|logout` |
| Sessions (own) | `GET /api/v1/auth/mobile/sessions` |

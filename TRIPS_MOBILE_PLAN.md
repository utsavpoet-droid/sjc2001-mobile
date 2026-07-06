# Trips & Expenses — Mobile App Implementation Plan
## For implementation by Codex

---

## Overview

Port the full Trips & Expenses feature from the web app to the React Native mobile app. Members can view their trips, see all attendees and their travel details, submit expenses, report payments, view balances, and upload photos to trip albums. The experience is read-heavy for most members (view trip, see who's coming, track balances) with a few write flows (submit expense, report payment, update travel details).

This doc is self-contained. Every section includes the exact file paths to create or modify, the API endpoints to call, and the UI/data patterns to follow from existing code.

---

## Tech Stack Conventions (from existing codebase)

| Concern | Pattern to follow |
|---|---|
| API calls | `requestContentJson(path, init)` from `src/lib/api/client.ts` with `Authorization: Bearer <token>` |
| Auth token | `const token = await useAuthStore.getState().getValidAccessToken()` |
| Server state | `useQuery` / `useMutation` from `@tanstack/react-query` |
| Navigation | Expo Router file-based: files in `src/app/(member)/` |
| Components | `Card`, `PrimaryButton`, `GhostButton`, `Input`, `Avatar` from `src/components/ui/primitives.tsx` |
| Theme colors | `useTheme()` hook from `src/hooks/use-theme.ts` |
| Icons | `Ionicons` from `@expo/vector-icons` |
| Lists | `FlatList` with `initialNumToRender: 12` |
| Mutations | `useMutation` + `queryClient.invalidateQueries()` on success |
| Error display | `Alert.alert('Error', message)` or inline error state |

---

## Backend API Endpoints (all existing, no new backend work needed)

Base: `https://www.sjcbatch2001.com/api` (content base — use `requestContentJson`)

All routes require `Authorization: Bearer <token>` header.

```
GET    /events/trip                          → list trips (member sees their own trips)
GET    /events/trip/:id                      → trip detail + stats
GET    /events/trip/:id/attendees            → attendee list (member must be attendee)
GET    /events/trip/:id/expenses             → all expenses for trip
GET    /events/trip/:id/balances             → full balance sheet
GET    /events/trip/:id/balances?mine=true   → just the authenticated member's balance
GET    /events/trip/:id/advances             → advance payments list
GET    /events/trip/:id/albums               → trip photo albums
GET    /events/trip/:id/albums/:alid         → album detail + photos (paginated)
GET    /events/trip/:id/my-travel            → member's own attendee travel record
PUT    /events/trip/:id/my-travel            → update own travel mode, airport, arrival/departure
POST   /events/trip/:id/expenses             → submit an expense (goes to PENDING_REVIEW)
POST   /events/trip/:id/advances             → self-report a payment
POST   /events/trip/:id/albums/:alid         → upload photo URL(s) to album
POST   /upload                               → get S3 presigned URL for file upload
```

---

## Phase 1 — Core Read Flows (implement first)

### 1.1 Add Trips tab to bottom navigation

**File to modify**: `src/app/(member)/(tabs)/_layout.tsx`

Add a new tab between Members and Account (or at the end):
```typescript
<Tabs.Screen
  name="trips"
  options={{
    title: 'Trips',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="airplane-outline" color={color} size={size} />
    ),
  }}
/>
```

Also create the tab index file: `src/app/(member)/(tabs)/trips/index.tsx` (see 1.2 below).

### 1.2 Trips list screen

**File to create**: `src/app/(member)/(tabs)/trips/index.tsx`

- Fetches `GET /events/trip` with Bearer token
- Query key: `['trips']`
- Displays a `FlatList` of trip cards, each showing:
  - Trip title (bold)
  - Date range (e.g. "May 7 – May 10, 2025")
  - Location (if set)
  - Status badge: PLANNING (blue), ACTIVE (green), RECONCILING (amber), SETTLED (slate), CANCELLED (red)
  - Attendee count and total spent (from `stats`)
- Tapping a card navigates to `trips/[id]`
- Empty state: "No trips yet" with a travel plane icon
- Pull-to-refresh

**API response shape** (for TypeScript interface):
```typescript
interface TripSummary {
  id: number;
  title: string;
  description: string | null;
  startDate: string;        // ISO date string YYYY-MM-DD
  endDate: string;
  location: string | null;
  status: 'PLANNING' | 'ACTIVE' | 'RECONCILING' | 'SETTLED' | 'CANCELLED';
  isPublic: boolean;
  stats: { totalSpent: number; expenseCount: number; attendeeCount: number };
}
```

### 1.3 Trip detail screen with tabs

**File to create**: `src/app/(member)/trips/[id].tsx`

This is the main detail screen. Use a horizontal tab strip (ScrollView with pressable tabs, not react-navigation tabs — keep navigation simple) to switch between sections:

**Tabs**: Overview · Attendees · Expenses · Balance · Albums

**Overview tab**:
- Countdown to trip start (if in future): "X days to go" in a highlight card
- My balance card: "You owe $XX" (red) or "You're owed $XX" (green) or "Settled ✓"
- Trip stats: Total Spent · Attendees · Expenses (3-column grid)
- My travel details card (read mode, with Edit button → travel edit sheet)
- "💳 Report Payment" button if balance > 0

**Attendees tab**:
- FlatList of attendee cards, each showing:
  - Name + status badge (CONFIRMED=green, INVITED=blue, DECLINED=grey, FORFEITED=red)
  - Travel mode (if set)
  - Arrival: date + airport code (e.g. "May 7, 10:30 · JFK")
  - Departure: date + airport code
- Ride-sharing section at bottom: group attendees by shared `arrivalAirport` (≥ 2 people), show "X people arriving at JFK — consider sharing a ride" card

**Expenses tab**:
- Filter chips: All · Approved · Pending
- FlatList of expense cards showing title, category icon, date, amount, status badge
- Expandable split breakdown (tap to expand)
- "+" FAB button to submit a new expense
- Filter out FORFEIT_CREDIT category from member view

**Balance tab**:
- Table-style list: each row = member name, share owed, total paid, balance
- My row highlighted
- Settlement section: "To settle everyone, X transactions are needed" — list of "A pays B $XX"

**Albums tab**:
- Grid of album cards (2 columns), each showing cover photo or placeholder, album title, photo count
- Tapping navigates to `trips/[id]/album/[alid]`

### 1.4 Trip album screen

**File to create**: `src/app/(member)/trips/[id]/album/[alid].tsx`

- Fetches `GET /events/trip/:id/albums/:alid?page=1&limit=50`
- Displays photos in a 3-column `FlatList` grid (like a camera roll)
- Tapping a photo opens it fullscreen (use existing `photo-preview` modal pattern)
- "Upload Photo" button → opens `ImagePicker`, uploads via presigned URL, posts URL to album
- Shows locked badge if `album.isLocked`

**Upload flow** (matches existing `postUploadPresign` in `src/features/content/api.ts`):
```
1. Pick image with expo-image-picker
2. POST /upload  { filename, contentType }  → { uploadUrl, publicUrl }
3. PUT uploadUrl  (file bytes)
4. POST /events/trip/:id/albums/:alid  { url: publicUrl, caption: optionalCaption }
5. Invalidate album query
```

---

## Phase 2 — Write Flows

### 2.1 Submit expense bottom sheet

Triggered by the "+" FAB on the Expenses tab.

**File to create**: `src/app/(member)/trips/[id]/submit-expense.tsx` (or implement as a modal sheet)

Fields:
- Title (required)
- Category (picker: Accommodation / Food / Transport / Activities / Alcohol / Supplies / Other)
- Date (date picker, defaults to today)
- Amount (numeric input)
- Notes (optional)
- Receipt (optional image or PDF — use `expo-document-picker` for PDFs, `expo-image-picker` for images, upload via `/api/upload` presigned flow, store URL)

On submit: `POST /events/trip/:id/expenses` with `{ title, category, date, totalAmount, notes, receiptUrl, splits: [] }` — admin reviews before it affects balances.

Show success message: "Expense submitted for admin review."

Invalidate `['trip-expenses', id]` on success.

### 2.2 Report payment bottom sheet

Triggered by "💳 Report Payment" button on the Overview tab.

**File to create**: inline sheet or `src/app/(member)/trips/[id]/report-payment.tsx`

Fields:
- Amount (numeric, pre-filled with outstanding balance)
- Notes (e.g. "Paid via Venmo")

On submit: `POST /events/trip/:id/advances` with `{ amount, notes, date: today }`.

Response: self-reported payment is flagged as pending admin confirmation. Show: "Payment reported — pending admin confirmation."

Invalidate `['trip-balance-mine', id]` and `['trips']` on success.

### 2.3 Edit travel details sheet

Triggered by "Edit" button on the My Travel Details card in Overview.

**File to create**: inline sheet or `src/app/(member)/trips/[id]/edit-travel.tsx`

Fields (all optional):
- Travel Mode (text input, e.g. "Flying Delta DL 401")
- Arrival Date & Time (`DateTimePicker` — use `@react-native-community/datetimepicker` which is already available in Expo)
- Arrival Airport (text input, 3-5 chars, auto-uppercase, placeholder "e.g. JFK")
- Departure Date & Time
- Departure Airport
- "📷 Scan from photo" button: pick an image → upload → `POST /events/trip/:id/scan-travel` → pre-fill fields (requires `ANTHROPIC_API_KEY` set in production)

On save: `PUT /events/trip/:id/my-travel` with updated fields.

Invalidate `['trip-my-travel', id]` on success.

---

## Phase 3 — Shared Types & API Module

### 3.1 Add API route constants

**File to modify**: `shared/contracts/api-routes.ts`

Add:
```typescript
export const API_TRIPS = '/events/trip' as const;
export const API_TRIP_DETAIL = '/events/trip/:id' as const;
export const API_TRIP_ATTENDEES = '/events/trip/:id/attendees' as const;
export const API_TRIP_EXPENSES = '/events/trip/:id/expenses' as const;
export const API_TRIP_BALANCES = '/events/trip/:id/balances' as const;
export const API_TRIP_ADVANCES = '/events/trip/:id/advances' as const;
export const API_TRIP_ALBUMS = '/events/trip/:id/albums' as const;
export const API_TRIP_ALBUM_DETAIL = '/events/trip/:id/albums/:alid' as const;
export const API_TRIP_MY_TRAVEL = '/events/trip/:id/my-travel' as const;
export const API_TRIP_SCAN_TRAVEL = '/events/trip/:id/scan-travel' as const;
```

### 3.2 Shared trip types

**File to create**: `shared/contracts/trips-contract.ts`

```typescript
export type TripStatus = 'PLANNING' | 'ACTIVE' | 'RECONCILING' | 'SETTLED' | 'CANCELLED';
export type AttendeeStatus = 'INVITED' | 'CONFIRMED' | 'DECLINED' | 'FORFEITED';
export type ExpenseCategory = 'ACCOMMODATION' | 'FOOD' | 'TRANSPORT' | 'ACTIVITIES' | 'ALCOHOL' | 'SUPPLIES' | 'FORFEIT_CREDIT' | 'OTHER';
export type ExpenseStatus = 'PENDING_REVIEW' | 'APPROVED' | 'FLAGGED' | 'REJECTED';

export interface TripSummary {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  coverPhotoUrl: string | null;
  status: TripStatus;
  isPublic: boolean;
  stats: { totalSpent: number; expenseCount: number; attendeeCount: number };
}

export interface TripAttendee {
  id: number;
  memberId: number | null;
  legendId: number | null;
  guestName: string | null;
  status: AttendeeStatus;
  shareRatio: string;
  travelMode: string | null;
  arrivalTime: string | null;
  arrivalAirport: string | null;
  departureTime: string | null;
  departureAirport: string | null;
  notes: string | null;
  member: { id: number; name: string } | null;
  legend: { id: number; name: string } | null;
}

export interface TripExpenseSplit {
  id: number;
  memberId: number | null;
  shareAmount: string;
  member: { id: number; name: string } | null;
  guestName: string | null;
}

export interface TripExpense {
  id: number;
  title: string;
  category: ExpenseCategory;
  date: string;
  totalAmount: string;
  currency: string;
  notes: string | null;
  receiptUrl: string | null;
  status: ExpenseStatus;
  flagReason: string | null;
  paidByMember: { id: number; name: string } | null;
  splits: TripExpenseSplit[];
  submittedBy: { id: number; name: string } | null;
}

export interface TripBalance {
  memberId: number | null;
  name: string;
  shareOwed: number;
  advancesPaid: number;
  fronted: number;
  directPaid: number;
  directReceived: number;
  totalPaid: number;
  balance: number;          // positive = owes, negative = is owed
  isSettled: boolean;
  hasPendingConfirmation: boolean;
}

export interface TripAlbum {
  id: number;
  title: string;
  coverPhotoUrl: string | null;
  isLocked: boolean;
  _count: { photos: number };
}

export interface TripAlbumPhoto {
  id: number;
  url: string;
  thumbUrl: string | null;
  caption: string | null;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  uploadedBy: { id: number; name: string } | null;
}

export interface MyTravelRecord {
  id: number;
  travelMode: string | null;
  arrivalTime: string | null;
  arrivalAirport: string | null;
  departureTime: string | null;
  departureAirport: string | null;
}

export interface TravelScanResult {
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  travelMode: string | null;
}

export interface SubmitExpenseBody {
  title: string;
  category: ExpenseCategory;
  date: string;             // YYYY-MM-DD
  totalAmount: number;
  notes?: string | null;
  receiptUrl?: string | null;
  splits: [];               // members always submit with empty splits; admin assigns splits
}

export interface ReportPaymentBody {
  amount: number;
  notes?: string;
  date: string;             // YYYY-MM-DD
}

export interface UpdateTravelBody {
  travelMode?: string | null;
  arrivalTime?: string | null;   // ISO datetime or null
  arrivalAirport?: string | null;
  departureTime?: string | null;
  departureAirport?: string | null;
}
```

### 3.3 Trips API module

**File to create**: `src/features/trips/api.ts`

```typescript
import { requestContentJson } from '@/lib/api/client';
import type {
  TripSummary, TripAttendee, TripExpense, TripBalance,
  TripAlbum, TripAlbumPhoto, MyTravelRecord, TravelScanResult,
  SubmitExpenseBody, ReportPaymentBody, UpdateTravelBody,
} from '@shared/contracts/trips-contract';

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getTrips(token: string): Promise<TripSummary[]> {
  return requestContentJson('/events/trip', { headers: auth(token) });
}

export async function getTripDetail(token: string, tripId: number) {
  return requestContentJson<TripSummary & { _count: { expenses: number; albums: number } }>(
    `/events/trip/${tripId}`, { headers: auth(token) }
  );
}

export async function getTripAttendees(token: string, tripId: number): Promise<TripAttendee[]> {
  return requestContentJson(`/events/trip/${tripId}/attendees`, { headers: auth(token) });
}

export async function getTripExpenses(token: string, tripId: number): Promise<TripExpense[]> {
  return requestContentJson(`/events/trip/${tripId}/expenses`, { headers: auth(token) });
}

export async function getTripBalances(token: string, tripId: number): Promise<TripBalance[]> {
  return requestContentJson(`/events/trip/${tripId}/balances`, { headers: auth(token) });
}

export async function getMyTripBalance(token: string, tripId: number): Promise<TripBalance | null> {
  return requestContentJson(`/events/trip/${tripId}/balances?mine=true`, { headers: auth(token) });
}

export async function getTripAlbums(token: string, tripId: number): Promise<TripAlbum[]> {
  return requestContentJson(`/events/trip/${tripId}/albums`, { headers: auth(token) });
}

export async function getTripAlbum(token: string, tripId: number, albumId: number) {
  return requestContentJson<{ album: TripAlbum; photos: TripAlbumPhoto[]; total: number }>(
    `/events/trip/${tripId}/albums/${albumId}`, { headers: auth(token) }
  );
}

export async function getMyTravel(token: string, tripId: number): Promise<MyTravelRecord> {
  return requestContentJson(`/events/trip/${tripId}/my-travel`, { headers: auth(token) });
}

export async function updateMyTravel(token: string, tripId: number, body: UpdateTravelBody): Promise<MyTravelRecord> {
  return requestContentJson(`/events/trip/${tripId}/my-travel`, {
    method: 'PUT',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function submitExpense(token: string, tripId: number, body: SubmitExpenseBody): Promise<TripExpense> {
  return requestContentJson(`/events/trip/${tripId}/expenses`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function reportPayment(token: string, tripId: number, body: ReportPaymentBody) {
  return requestContentJson(`/events/trip/${tripId}/advances`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function addPhotoToAlbum(token: string, tripId: number, albumId: number, url: string, caption?: string) {
  return requestContentJson(`/events/trip/${tripId}/albums/${albumId}`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, caption: caption ?? null }),
  });
}

export async function scanTravelImage(token: string, tripId: number, imageUrl: string): Promise<TravelScanResult> {
  return requestContentJson(`/events/trip/${tripId}/scan-travel`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
}
```

---

## Phase 4 — Date Handling (important — same fix as web app)

**Problem**: Dates stored as `YYYY-MM-DD` are parsed by `new Date()` as UTC midnight, which shifts to the previous day in US timezones.

**Fix**: Use this helper in any screen that displays trip dates:

```typescript
function parseDay(d: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  return new Date(d);
}

function fmtTripDate(d: string): string {
  return parseDay(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}
```

For datetime fields (arrivalTime, departureTime) that include a time component (`T10:30:00`), use regular `new Date(d)` and format with local timezone — these represent actual local times.

---

## File Creation Checklist

### New files to create
```
shared/contracts/trips-contract.ts
src/features/trips/api.ts
src/app/(member)/(tabs)/trips/index.tsx        ← trips list tab
src/app/(member)/trips/[id].tsx                ← trip detail (multi-section)
src/app/(member)/trips/[id]/album/[alid].tsx   ← album photo grid + upload
```

### Files to modify
```
shared/contracts/api-routes.ts                 ← add trip API constants
src/app/(member)/(tabs)/_layout.tsx            ← add Trips tab
```

Optional (Phase 2 write flows — can be inline sheets or separate files):
```
src/app/(member)/trips/[id]/submit-expense.tsx
src/app/(member)/trips/[id]/report-payment.tsx
src/app/(member)/trips/[id]/edit-travel.tsx
```

---

## React Query Key Convention

Use these consistent query keys so invalidation works correctly across screens:

```typescript
['trips']                               // trips list
['trip', id]                            // trip detail
['trip-attendees', id]                  // attendees list
['trip-expenses', id]                   // expenses list
['trip-balances', id]                   // full balance sheet
['trip-balance-mine', id]               // my balance only
['trip-albums', id]                     // albums list
['trip-album', id, albumId]             // album detail + photos
['trip-my-travel', id]                  // my travel record
```

---

## Settlement Calculation (client-side, no API call needed)

Port the greedy min-cash-flow algorithm from `lib/settleBalances.ts` in the web app directly to the mobile app. Place it in `src/features/trips/settle-balances.ts`. The algorithm is pure TypeScript with no dependencies.

```typescript
export interface SettlementTransaction {
  fromName: string; fromId: number;
  toName: string;   toId: number;
  amount: number;
}

export function computeSettlement(
  balances: { memberId: number | null; name: string; balance: number }[]
): SettlementTransaction[] { ... } // same implementation as web
```

Use this in the Balance tab of the trip detail screen to show "To settle up: A pays B $XX".

---

## Scope Boundaries (what NOT to build in this phase)

- **No admin actions** — members only. No expense approval, no status changes, no attendee management.
- **No direct payments** — show existing direct payment records in the balance but don't allow creating them from mobile (admin-only flow).
- **No forfeit flow** — admin only.
- **No trip creation** — admin only.
- **AI scan is optional** in the first mobile release — it requires image upload + network round-trip, add it in a follow-up if needed.

---

## Notes for Codex

1. **`requestContentJson` does NOT use the `/api/v1` envelope** — it returns raw JSON. The trips API returns plain arrays/objects, not `{ success, data }`. Do not unwrap.

2. **Token pattern** — always call `useAuthStore.getState().getValidAccessToken()` (which auto-refreshes if expired) inside `queryFn` and `mutationFn`. Never store the token in component state.

3. **Navigation** — Expo Router file-based. To navigate to a trip: `router.push('/trips/42')`. The file `src/app/(member)/trips/[id].tsx` handles this automatically.

4. **No `@react-native-community/datetimepicker` may be installed** — check `package.json` first. If not present, use a simple text input with format hint ("YYYY-MM-DD HH:MM") as a fallback, or use `expo-date-picker` if available. Do not add new dependencies without checking.

5. **Shared import path** — the tsconfig likely maps `@shared/` to `../../shared/`. Check `tsconfig.json` paths before importing shared types. If no path alias exists, use relative imports: `'../../../../../shared/contracts/trips-contract'`.

6. **Pull-to-refresh** — add `RefreshControl` to all FlatLists. Use `refetch` from React Query.

7. **Loading states** — show `ActivityIndicator` centered while `isLoading`, error state if `isError`.

8. **Member-only trips** — the backend `GET /events/trip` already filters to trips where the authenticated member is an attendee. No client-side filtering needed.

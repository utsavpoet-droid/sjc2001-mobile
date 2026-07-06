# Trips Feature Plan

## Purpose

This plan is for the mobile repo only and is grounded in the current state of both codebases on 2026-04-23.

The goal is to add a member-facing Trips feature to `sjc2001-mobile` that matches the current website member experience while also aligning with the mobile app's API conventions, routing structure, React Query usage, and theme system.

## Current Codebase Findings

### Mobile architecture that this feature must follow

- Mobile route constants live in [shared/contracts/api-routes.ts](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/shared/contracts/api-routes.ts:1).
- Mobile has two API clients in [src/lib/api/client.ts](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/lib/api/client.ts:1).
- `requestV1Json` is for `/api/v1` and expects `{ success, data }`.
- `requestContentJson` is for `/api` and expects raw JSON.
- The app is intentionally moving toward `/api/v1` consistency; this is also called out in the design doc's known issues section.
- Member tabs are registered in [src/app/(member)/(tabs)/_layout.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/(tabs)/_layout.tsx:1).
- Member stack routes are declared in [src/app/(member)/_layout.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/_layout.tsx:1).
- The mobile UI theme comes from [src/constants/theme.ts](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/constants/theme.ts:1).
- Scrollable screens should use [src/components/ui/screen.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/components/ui/screen.tsx:1).
- Existing feature modules follow the pattern already used in [src/features/member/api.ts](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/features/member/api.ts:1).

### Website/backend reality today

- Trips already exist in the website Prisma schema and API.
- Current trip endpoints are implemented under `/api/events/trip/...`, not `/api/v1/events/trip/...`.
- Current member web pages consume those raw `/api/events/trip/...` routes in:
  - [app/(member)/member/trips/page.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-website/app/(member)/member/trips/page.tsx:1)
  - [app/(member)/member/trips/[id]/page.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-website/app/(member)/member/trips/[id]/page.tsx:1)
- Current balance logic is centralized in [lib/tripBalances.ts](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-website/lib/tripBalances.ts:1).

### Important dependency to acknowledge

The requested mobile plan assumes a new `API_TRIPS` contract in `shared/contracts/api-routes.ts` and mobile-first usage via `/api/v1`.

That is the right direction.

However, today there are no `/api/v1/events/trip/...` website endpoints. So Phase 3 and onward should be implemented against a v1 contract only after the website adds v1 wrappers or migrates the current raw routes. The mobile plan below is written for that target contract and explicitly notes the current backend gap.

## Recommended Contract Direction

Use a new shared route constant:

```ts
export const API_TRIPS = '/events/trip' as const;
```

And treat it as a versionless route constant that mobile joins to the v1 base:

- Mobile target URL shape: `/api/v1/events/trip/...`
- Client helper: `requestV1Json`
- Response shape: `{ success: true, data: ... }`

This keeps Trips aligned with the app's auth and push APIs and avoids deepening the existing v1/content split.

## Phase Plan

### Phase 1

Add `API_TRIPS` constant.

File:
- `shared/contracts/api-routes.ts`

Implementation:

```ts
export const API_TRIPS = '/events/trip' as const;
```

Notes:
- Keep it versionless, matching the rest of the file.
- Mobile code should join it with the v1 base, not hardcode `/api/v1`.

### Phase 2

Create mobile Trips types.

File:
- `src/features/trips/types.ts`

Use types that match the current website payloads closely enough to avoid guesswork, but bias naming toward the mobile domain model rather than mirroring every backend quirk.

Recommended types:

```ts
export type TripStatus = 'PLANNING' | 'ACTIVE' | 'RECONCILING' | 'SETTLED' | 'CANCELLED';
export type AttendeeStatus = 'INVITED' | 'CONFIRMED' | 'DECLINED' | 'FORFEITED';
export type ExpenseStatus = 'PENDING_REVIEW' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
export type ExpenseCategory =
  | 'ACCOMMODATION'
  | 'FOOD'
  | 'TRANSPORT'
  | 'ACTIVITIES'
  | 'ALCOHOL'
  | 'SUPPLIES'
  | 'FORFEIT_CREDIT'
  | 'OTHER';
export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export type TripSummary = {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  coverPhotoUrl: string | null;
  status: TripStatus;
  isPublic: boolean;
  attendees?: Array<{
    status: AttendeeStatus;
    shareRatio?: string | number | null;
  }>;
  _count?: {
    attendees: number;
    expenses: number;
    albums?: number;
  };
};

export type TripDetail = TripSummary & {
  attendees: Array<{
    id: number;
    memberId: number | null;
    legendId: number | null;
    guestName: string | null;
    status: AttendeeStatus;
    shareRatio?: string | number | null;
    member?: { id: number; name: string | null } | null;
    legend?: { id: number; name: string | null } | null;
  }>;
  stats: {
    totalSpent: number;
    expenseCount: number;
    attendeeCount: number;
  };
};

export type AttendeeBalance = {
  memberId: number | null;
  legendId: number | null;
  guestName: string | null;
  name: string;
  shareOwed: number;
  advancesPaid: number;
  fronted: number;
  totalPaid: number;
  balance: number;
  isSettled: boolean;
  hasPendingConfirmation: boolean;
};

export type TripExpenseSplit = {
  id: number;
  memberId: number | null;
  legendId?: number | null;
  guestName: string | null;
  shareAmount: string | number;
  shareUnit?: string | number | null;
  sharePercent?: string | number | null;
  member?: { id: number; name: string | null } | null;
};

export type TripExpense = {
  id: number;
  title: string;
  category: ExpenseCategory;
  date: string;
  totalAmount: string | number;
  currency: string;
  notes: string | null;
  receiptUrl: string | null;
  receiptThumbUrl?: string | null;
  status: ExpenseStatus;
  flagReason?: string | null;
  adminNote?: string | null;
  splitType: SplitType;
  paidByMemberId?: number | null;
  paidByName?: string | null;
  paidByMember?: { id: number; name: string | null } | null;
  submittedBy?: { id: number; name: string | null } | null;
  splits: TripExpenseSplit[];
};

export type TripAdvance = {
  id: number;
  memberId: number;
  amount: string | number;
  date: string;
  notes: string | null;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  isForfeited: boolean;
  isSelfReported?: boolean;
  isAdminConfirmed?: boolean;
  member?: { id: number; name: string | null } | null;
};

export type TripAlbum = {
  id: number;
  title: string;
  coverPhotoUrl: string | null;
  isLocked: boolean;
  _count?: { photos: number };
};

export type TripAlbumPhoto = {
  id: number;
  albumId: number;
  url: string;
  thumbUrl: string | null;
  caption: string | null;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  uploadedByMemberId?: number | null;
  uploadedBy?: { id: number; name: string | null } | null;
};

export type SubmitTripExpenseInput = {
  title: string;
  category: ExpenseCategory;
  date: string;
  totalAmount: number;
  currency?: string;
  notes?: string;
  receiptUrl?: string;
  receiptThumbUrl?: string;
  paidByMemberId?: number;
  splitType?: SplitType;
  splits: Array<{
    memberId?: number;
    legendId?: number;
    guestName?: string;
    shareAmount: number;
    shareUnit?: number;
    sharePercent?: number;
  }>;
};

export type SelfReportPaymentInput = {
  amount: number;
  date: string;
  notes?: string;
};
```

Type guidance:
- Keep amount/date fields typed to match the wire first.
- Normalize decimals in UI helpers, not inside the wire types.
- Do not invent fields the website does not currently return.

### Phase 3

Create trip API functions.

File:
- `src/features/trips/api.ts`

Use the same style as `src/features/member/api.ts`.

Target implementation pattern:

```ts
import { requestV1Json } from '@/lib/api/client';
import { API_TRIPS } from '@shared/contracts/api-routes';
import type {
  AttendeeBalance,
  SelfReportPaymentInput,
  SubmitTripExpenseInput,
  TripAlbum,
  TripAlbumPhoto,
  TripDetail,
  TripExpense,
  TripSummary,
} from './types';

function bearerJson(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function bearerOnly(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function getMyTrips(accessToken: string) {
  return requestV1Json<TripSummary[]>(`${API_TRIPS}?mine=true`, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function getTrip(tripId: number, accessToken: string) {
  return requestV1Json<TripDetail>(`${API_TRIPS}/${tripId}`, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function getMyBalance(tripId: number, accessToken: string) {
  return requestV1Json<AttendeeBalance | null>(`${API_TRIPS}/${tripId}/balances?mine=true`, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function getAllBalances(tripId: number, accessToken: string) {
  return requestV1Json<AttendeeBalance[]>(`${API_TRIPS}/${tripId}/balances`, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function getMyExpenses(tripId: number, accessToken: string) {
  return requestV1Json<TripExpense[]>(`${API_TRIPS}/${tripId}/expenses?submittedByMe=true`, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function getApprovedExpenses(tripId: number, accessToken: string) {
  return requestV1Json<TripExpense[]>(`${API_TRIPS}/${tripId}/expenses`, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function submitExpense(
  tripId: number,
  accessToken: string,
  body: SubmitTripExpenseInput,
) {
  return requestV1Json<TripExpense>(`${API_TRIPS}/${tripId}/expenses`, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify(body),
  });
}

export async function selfReportPayment(
  tripId: number,
  accessToken: string,
  body: SelfReportPaymentInput,
) {
  return requestV1Json(`${API_TRIPS}/${tripId}/advances`, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify(body),
  });
}

export async function getTripAlbums(tripId: number, accessToken: string) {
  return requestV1Json<TripAlbum[]>(`${API_TRIPS}/${tripId}/albums`, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function getAlbumPhotos(
  tripId: number,
  albumId: number,
  accessToken: string,
  params?: { page?: number; limit?: number },
) {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  const suffix = search.toString();
  return requestV1Json<{ photos: TripAlbumPhoto[]; total: number; page: number; limit: number }>(
    `${API_TRIPS}/${tripId}/albums/${albumId}${suffix ? `?${suffix}` : ''}`,
    {
      method: 'GET',
      headers: bearerOnly(accessToken),
    },
  );
}
```

Backend dependency note:
- Until the website exposes `/api/v1/events/trip/...`, these functions cannot be wired to live data through `requestV1Json`.
- If the mobile work starts before the backend alignment lands, keep this file scaffolded but feature-flag usage or point the plan owner back to the website team for the v1 wrapper work.

### Phase 4

Register Trips in the bottom tab bar.

File:
- `src/app/(member)/(tabs)/_layout.tsx`

Changes:
- Add `'trips/index': 'airplane'` to `tabIcons`.
- Add `<Tabs.Screen name="trips/index" options={{ title: 'Trips' }} />`.

Recommended order:
- `home`
- `members/index`
- `stories/index`
- `trips/index`
- `gallery/index`
- `account/index`

Reason:
- Trips belongs with active member participation, and placing it before Gallery matches the feature priority better than burying it after Gallery.

### Phase 5

Build the Trips tab list screen.

File:
- `src/app/(member)/(tabs)/trips/index.tsx`

Reference patterns:
- [src/app/(member)/(tabs)/gallery/index.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/(tabs)/gallery/index.tsx:1)
- [src/app/(member)/(tabs)/members/index.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/(tabs)/members/index.tsx:1)
- [src/app/(member)/(tabs)/home.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/(tabs)/home.tsx:1)

Screen behavior:
- Query trips with `getMyTrips`.
- For `ACTIVE` and `RECONCILING` trips, fetch `getMyBalance` in parallel after the list resolves.
- Render trip cards with:
  - cover image or themed placeholder
  - title
  - location
  - date range
  - status pill
  - balance pill
  - attendee/expense counts when present
- Tap navigates to `/(member)/trips/[id]`.

Suggested query keys:

```ts
['trips', 'mine']
['trip-balance-batch', tripIds.join(',')]
['trip', tripId, 'balance', 'mine']
```

Preferred implementation detail:
- Keep the list query as the source of truth.
- Use `Promise.all` for balance fetches after trips load, limited to active/reconciling trips.
- Store balance results in a local `Record<number, AttendeeBalance | null>` or derive them with child queries if the list stays small.

Card copy rules:
- Positive balance: `You owe $118.33`
- Negative balance: `You're owed $42.00`
- Settled: `Settled`
- Planning trips should not show a warning-colored balance state.

### Phase 6

Build trip detail screen with 5 in-screen tabs.

File:
- `src/app/(member)/trips/[id].tsx`

Reference patterns:
- [src/app/(member)/members/[id].tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/members/[id].tsx:1)
- [src/app/(member)/gallery/[id].tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/gallery/[id].tsx:1)

Tabs to implement inside the screen:
- `Overview`
- `My Expenses`
- `All Expenses`
- `Balance Sheet`
- `Albums`

Data loading:
- Primary detail query: `getTrip(tripId, accessToken)`
- Secondary queries:
  - `getMyBalance`
  - `getMyExpenses`
  - `getApprovedExpenses`
  - `getAllBalances`
  - `getTripAlbums`

Suggested query keys:

```ts
['trip', tripId]
['trip', tripId, 'balance', 'mine']
['trip', tripId, 'expenses', 'mine']
['trip', tripId, 'expenses', 'approved']
['trip', tripId, 'balances']
['trip', tripId, 'albums']
```

Overview tab:
- Countdown block when `startDate` is in the future.
- Personal balance card driven by `getMyBalance`.
- Stat row using `event.stats`.
- Description card when present.
- Self-report payment action using `selfReportPayment`.
- If `hasPendingConfirmation` is true, show a muted pending notice instead of pretending the payment is complete.

My Expenses tab:
- Use `getMyExpenses`.
- Show status pills for `PENDING_REVIEW`, `APPROVED`, `FLAGGED`, `REJECTED`.
- Expand cards to display split participants and amounts.
- Include submit-expense CTA.
- Submit form should use attendee names from `getAllBalances` or `trip.attendees`.

Expense submission UX rules:
- Default payer should be the current member.
- Default split should be equal across confirmed attendees when attendee data is present.
- Validate split totals before enabling submit.
- Use a modal or bottom sheet, but keep the implementation consistent with current mobile patterns and avoid adding a new dependency just for this screen.

All Expenses tab:
- Use `getApprovedExpenses`.
- Read-only cards.
- No status badge needed if the API already returns approved-only data.

Balance Sheet tab:
- Use `getAllBalances`.
- Highlight the current member row.
- Show pending confirmation indicator per attendee if present.
- Make the financial columns easy to scan, even if implemented as stacked rows instead of a real table.

Albums tab:
- Use `getTripAlbums`.
- Two-column card grid is enough for v1.
- Each card links to `/(member)/trips/[id]/albums/[alid]`.

Mutation invalidation:

```ts
['trip', tripId, 'expenses', 'mine']
['trip', tripId, 'expenses', 'approved']
['trip', tripId, 'balance', 'mine']
['trip', tripId, 'balances']
['trip', tripId]
```

### Phase 7

Build album photos grid screen.

File:
- `src/app/(member)/trips/[id]/albums/[alid].tsx`

Reference patterns:
- [src/app/(member)/gallery/[id].tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/gallery/[id].tsx:1)
- [src/app/(member)/gallery/photo.tsx](/Users/utsav/Documents/Documents%20-%20Utsav%E2%80%99s%20Mac%20mini/Projects'/SJC/sjc2001-mobile/src/app/(member)/gallery/photo.tsx:1)

Scope for v1:
- Show album title and lock state.
- Fetch paginated photos through `getAlbumPhotos`.
- Render a 2-column or 3-column grid depending on what looks better with the current spacing scale.
- Use existing image resolution helpers from `src/lib/api/bases.ts`.
- Reuse the existing full-screen photo presentation pattern if possible instead of inventing a separate viewer.

Suggested query key:

```ts
['trip', tripId, 'album', albumId, 'photos', page, limit]
```

If the website does not yet expose photo-list endpoints for trip albums in v1, mark this phase blocked by backend parity work.

### Phase 8

Verify Expo Router wiring.

Files:
- `src/app/(member)/_layout.tsx`
- `src/app/(member)/(tabs)/_layout.tsx`

Checks:
- Trips tab appears and is reachable.
- Pushed routes resolve correctly:
  - `trips/[id]`
  - `trips/[id]/albums/[alid]`
- Add explicit `<Stack.Screen>` registrations in `(member)/_layout.tsx` if navigation behavior needs tighter control, matching the existing pattern used for `gallery/[id]`, `members/[id]`, and other pushed screens.

Recommended additions if we want explicit stack registration:

```tsx
<Stack.Screen name="trips/[id]" />
<Stack.Screen name="trips/[id]/albums/[alid]" />
```

## API Call Patterns

Use these patterns in the mobile implementation:

### Read calls

```ts
const accessToken = await getValidAccessToken();
if (!accessToken) throw new Error('Please sign in again.');

return getMyTrips(accessToken);
```

or inside a screen:

```ts
const accessToken = useAuthStore((state) => state.accessToken);
const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);

const tripQuery = useQuery({
  queryKey: ['trip', tripId],
  queryFn: async () => {
    const token = await getValidAccessToken();
    if (!token) throw new Error('Please sign in again.');
    return getTrip(tripId, token);
  },
  enabled: Number.isFinite(tripId),
});
```

### Mutation calls

```ts
const queryClient = useQueryClient();

const submitExpenseMutation = useMutation({
  mutationFn: async (input: SubmitTripExpenseInput) => {
    const token = await getValidAccessToken();
    if (!token) throw new Error('Please sign in again.');
    return submitExpense(tripId, token, input);
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'expenses', 'mine'] });
    await queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'expenses', 'approved'] });
    await queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'balance', 'mine'] });
    await queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'balances'] });
  },
});
```

## React Query Key Conventions

Use stable, structured keys:

```ts
['trips', 'mine']
['trip', tripId]
['trip', tripId, 'balance', 'mine']
['trip', tripId, 'balances']
['trip', tripId, 'expenses', 'mine']
['trip', tripId, 'expenses', 'approved']
['trip', tripId, 'albums']
['trip', tripId, 'album', albumId, 'photos', page, limit]
```

Rules:
- Always include `tripId` and `albumId` as separate segments.
- Do not compress unrelated state into a single string key if an array key will do.
- Prefer query invalidation by prefix only when the blast radius is intentional.

## Currency and Date Formatting

Do not use the India-specific formatting found in some older mobile screens.

Trips should follow the design document and current website behavior:
- Default currency is `USD`.
- Use `en-US`.

Recommended helpers:

```ts
export function formatTripCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTripDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTripDateRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
  }

  return `${formatTripDate(start)} - ${formatTripDate(end)}`;
}
```

Normalization rule:
- Convert decimal-like values to numbers before formatting with `Number(...)` or a small helper.
- Do not render raw Prisma decimal strings directly in the UI.

## Color and Theme Notes

Use the existing theme system from `src/constants/theme.ts`.

Preferred roles:
- Card background: `colors.surface`
- Secondary sections: `colors.surfaceMuted` or `colors.backgroundSoft`
- Borders: `colors.border`
- Primary action: `colors.accent`
- Positive financial state: `colors.success`
- Negative financial state: `colors.danger`
- Muted labels: `colors.textMuted`
- Body text: `colors.text`

Trips-specific visual mapping:
- `PLANNING`: muted neutral surface
- `ACTIVE`: success-tinted pill
- `RECONCILING`: accent-tinted pill
- `SETTLED`: success pill
- `CANCELLED`: danger-tinted pill

Balance mapping:
- member owes money: `colors.danger`
- member is owed money: `colors.success`
- settled: use success but quieter background

UI style guidance:
- Match the existing app's warm rounded card language.
- Keep Trips consistent with Gallery and Home rather than introducing a different design system.
- Avoid emoji-first labels inside core navigation UI; use icons there and keep emoji to lightweight supportive content only.

## Proposed File Layout

```text
shared/contracts/api-routes.ts

src/features/trips/types.ts
src/features/trips/api.ts

src/app/(member)/(tabs)/_layout.tsx
src/app/(member)/(tabs)/trips/index.tsx

src/app/(member)/trips/[id].tsx
src/app/(member)/trips/[id]/albums/[alid].tsx
src/app/(member)/_layout.tsx
```

## Implementation Order

1. Add the shared route constant.
2. Add types and API module.
3. Confirm backend v1 support exists for the trip endpoints.
4. Register the Trips tab.
5. Build the tab list.
6. Build trip detail.
7. Build album grid.
8. Verify routing and invalidation behavior on device.

## Explicit Risks

1. The current website does not yet expose `/api/v1/events/trip/...`, so the mobile contract in this plan depends on website API alignment.
2. The current website member trip pages still use raw `/api/events/trip/...` payloads, so field names should be verified once the v1 wrappers are added.
3. Trip album photo pagination endpoints are not currently visible in the inspected website files, so Phase 7 may require backend expansion.
4. Expense submission UX can get complicated if exact split editing is attempted in v1; equal split plus editable overrides is the safest first release.

## Definition of Done

The mobile repo is ready for Trips when all of the following are true:

- The tab bar contains a working Trips entry.
- Members can view their trips list.
- Members can open a trip and use all 5 in-screen tabs.
- Members can submit an expense and self-report a settlement payment.
- Balance data refreshes correctly after mutations.
- Albums open and photo grids render without layout regressions.
- All trip requests use the agreed contract path and client helper consistently.

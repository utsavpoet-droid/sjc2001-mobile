import { requestContentJson } from '@/lib/api/client';
import type {
  MyTravelRecord,
  ReportPaymentBody,
  SubmitExpenseBody,
  TravelScanResult,
  TripAlbum,
  TripAlbumPhoto,
  TripAttendee,
  TripBalance,
  TripExpense,
  TripSummary,
  UpdateTravelBody,
} from '@shared/contracts/trips-contract';

function auth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function authJson(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getTrips(token: string): Promise<TripSummary[]> {
  return requestContentJson('/events/trip', { headers: auth(token) });
}

export async function getTripDetail(
  token: string,
  tripId: number,
): Promise<TripSummary & { _count: { expenses: number; albums: number } }> {
  return requestContentJson(`/events/trip/${tripId}`, { headers: auth(token) });
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

export async function getTripAlbum(
  token: string,
  tripId: number,
  albumId: number,
): Promise<{ album: TripAlbum; photos: TripAlbumPhoto[]; total: number }> {
  return requestContentJson(`/events/trip/${tripId}/albums/${albumId}`, { headers: auth(token) });
}

export async function getMyTravel(token: string, tripId: number): Promise<MyTravelRecord> {
  return requestContentJson(`/events/trip/${tripId}/my-travel`, { headers: auth(token) });
}

export async function updateMyTravel(
  token: string,
  tripId: number,
  body: UpdateTravelBody,
): Promise<MyTravelRecord> {
  return requestContentJson(`/events/trip/${tripId}/my-travel`, {
    method: 'PUT',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function submitExpense(
  token: string,
  tripId: number,
  body: SubmitExpenseBody,
): Promise<TripExpense> {
  return requestContentJson(`/events/trip/${tripId}/expenses`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function reportPayment(
  token: string,
  tripId: number,
  body: ReportPaymentBody,
): Promise<unknown> {
  return requestContentJson(`/events/trip/${tripId}/advances`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
}

export async function addPhotoToAlbum(
  token: string,
  tripId: number,
  albumId: number,
  url: string,
  caption?: string,
): Promise<unknown> {
  return requestContentJson(`/events/trip/${tripId}/albums/${albumId}`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify({ url, caption: caption ?? null }),
  });
}

export async function scanTravelImage(
  token: string,
  tripId: number,
  imageUrl: string,
): Promise<TravelScanResult> {
  return requestContentJson(`/events/trip/${tripId}/scan-travel`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify({ imageUrl }),
  });
}

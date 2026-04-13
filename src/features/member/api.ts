import { requestContentJson } from '@/lib/api/client';

import {
  API_MEMBER_ACTIVITY,
  API_MEMBER_ACTIVITY_SEEN,
  API_MEMBER_CHANGE_PASSWORD,
  API_MEMBER_PROFILE,
  API_MEMBER_PROFILES,
  API_MEMBER_TOTP_DISABLE,
  API_MEMBER_TOTP_SETUP,
  API_MEMBER_TOTP_VERIFY,
} from '@shared/contracts/api-routes';

function bearerJson(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function bearerOnly(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type MemberProfile = {
  title?: string | null;
  comments?: string | null;
  schoolPhotoUrl?: string | null;
  schoolPhotoFocalX?: number | null;
  schoolPhotoFocalY?: number | null;
  currentPhotoUrl?: string | null;
  currentPhotoFocalX?: number | null;
  currentPhotoFocalY?: number | null;
  contactPhotoUrl?: string | null;
  contactPhotoFocalX?: number | null;
  contactPhotoFocalY?: number | null;
  familyPhotos: Array<{ photoUrl: string; sortOrder?: number }>;
};

export type MemberProfileDirectoryItem = MemberProfile & {
  id?: number;
  user?: {
    memberId?: number;
    member?: {
      name?: string | null;
      city?: string | null;
      country?: string | null;
    };
  };
};

export type MemberProfilesResponse = {
  profiles: MemberProfileDirectoryItem[];
  total: number;
  page: number;
  limit: number;
};

export function memberProfileHasContent(profile?: Partial<MemberProfile> | null) {
  if (!profile) return false;
  const title = typeof profile.title === 'string' ? profile.title.trim() : '';
  const comments = typeof profile.comments === 'string' ? profile.comments.trim() : '';
  const school = typeof profile.schoolPhotoUrl === 'string' ? profile.schoolPhotoUrl.trim() : '';
  const current = typeof profile.currentPhotoUrl === 'string' ? profile.currentPhotoUrl.trim() : '';
  const family = Array.isArray(profile.familyPhotos)
    ? profile.familyPhotos.some((photo) => typeof photo?.photoUrl === 'string' && photo.photoUrl.trim().length > 0)
    : false;

  return Boolean(title || comments || school || current || family);
}

export type MemberActivityItem = {
  type: string;
  target: string;
  entityType?: string;
  entityId?: number;
  id?: number;
  title?: string;
  authorName?: string;
  body?: string;
  createdAt: string;
  isNew?: boolean;
};

export type MemberActivityResponse = {
  unseen: number;
  items: MemberActivityItem[];
};

export type MemberTotpSetup = {
  qrCodeUrl: string;
  secret: string;
};

export async function getMemberProfile(accessToken: string) {
  return requestContentJson<MemberProfile>(API_MEMBER_PROFILE, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function getMemberProfiles(
  accessToken: string,
  params: {
    name?: string;
    city?: string;
    country?: string;
    title?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const searchParams = new URLSearchParams();
  if (params.name) searchParams.set('name', params.name);
  if (params.city) searchParams.set('city', params.city);
  if (params.country) searchParams.set('country', params.country);
  if (params.title) searchParams.set('title', params.title);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const suffix = searchParams.toString();
  return requestContentJson<MemberProfilesResponse>(`${API_MEMBER_PROFILES}${suffix ? `?${suffix}` : ''}`, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function putMemberProfile(
  accessToken: string,
  body: {
    title?: string;
    comments?: string;
    schoolPhotoUrl?: string;
    schoolPhotoFocalX?: number;
    schoolPhotoFocalY?: number;
    currentPhotoUrl?: string;
    currentPhotoFocalX?: number;
    currentPhotoFocalY?: number;
    contactPhotoUrl?: string;
    contactPhotoFocalX?: number;
    contactPhotoFocalY?: number;
    familyPhotos?: string[];
  },
) {
  return requestContentJson<MemberProfile>(API_MEMBER_PROFILE, {
    method: 'PUT',
    headers: bearerJson(accessToken),
    body: JSON.stringify(body),
  });
}

export async function postMemberChangePassword(
  accessToken: string,
  body: { currentPassword: string; newPassword: string },
) {
  return requestContentJson<{ success: true }>(API_MEMBER_CHANGE_PASSWORD, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify(body),
  });
}

export async function postMemberTotpSetup(accessToken: string) {
  return requestContentJson<MemberTotpSetup>(API_MEMBER_TOTP_SETUP, {
    method: 'POST',
    headers: bearerOnly(accessToken),
  });
}

export async function postMemberTotpVerify(accessToken: string, code: string) {
  return requestContentJson<{ success: true }>(API_MEMBER_TOTP_VERIFY, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify({ code }),
  });
}

export async function postMemberTotpDisable(accessToken: string, code: string) {
  return requestContentJson<{ success: true }>(API_MEMBER_TOTP_DISABLE, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify({ code }),
  });
}

export async function getMemberActivity(accessToken: string) {
  return requestContentJson<MemberActivityResponse>(API_MEMBER_ACTIVITY, {
    method: 'GET',
    headers: bearerOnly(accessToken),
  });
}

export async function postMemberActivitySeen(accessToken: string) {
  return requestContentJson<{ ok: true }>(API_MEMBER_ACTIVITY_SEEN, {
    method: 'POST',
    headers: bearerOnly(accessToken),
  });
}

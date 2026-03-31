import { requestContentJson } from '@/lib/api/client';

import {
  API_MEMBER_ACTIVITY,
  API_MEMBER_ACTIVITY_SEEN,
  API_MEMBER_CHANGE_PASSWORD,
  API_MEMBER_PROFILE,
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
  currentPhotoUrl?: string | null;
  familyPhotos: Array<{ photoUrl: string; sortOrder?: number }>;
};

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

export async function putMemberProfile(
  accessToken: string,
  body: {
    title?: string;
    comments?: string;
    schoolPhotoUrl?: string;
    currentPhotoUrl?: string;
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

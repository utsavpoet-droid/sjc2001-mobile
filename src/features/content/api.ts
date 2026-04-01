/**
 * Content routes under `/api` — raw JSON (no `{ success, data }`).
 * Authenticated calls pass **access** Bearer token (not refresh).
 */

import { requestContentJson } from '@/lib/api/client';
import {
  mapReactionToggleFromWire,
  mapUploadResponseFromWire,
  normalizeStoriesListFromWire,
  normalizeStoryFromWire,
  storyEntityIdAsNumber,
} from '@/lib/api/wire-alignment';

import {
  API_COMMENTS,
  API_GALLERY,
  API_GIPHY,
  API_MEMBERS,
  API_MEMBERS_SEARCH,
  API_POLLS,
  API_REACTIONS,
  API_SILVER_JUBILEE,
  API_STORIES,
  API_UPLOAD,
} from '@shared/contracts/api-routes';

export type ReactionEntityType = 'member' | 'gallery_album' | 'gallery_photo' | 'story' | 'comment';
export type CommentableEntityType = 'member' | 'gallery_album' | 'gallery_photo' | 'story';

const API_ENGAGEMENT = '/engagement';
const API_NEWS = '/news';

export type GifSearchResult = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
};

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}

function bearerJson(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function optionalBearer(accessToken?: string | null): HeadersInit | undefined {
  if (!accessToken) return undefined;
  return { Authorization: `Bearer ${accessToken}` };
}

function normalizeEntityId(entityType: ReactionEntityType, entityId: string): number {
  if (entityType === 'story') return storyEntityIdAsNumber(entityId);
  const numeric = Number(String(entityId).trim());
  if (!Number.isFinite(numeric)) throw new Error('Invalid entity id');
  return numeric;
}

export async function getStoriesPage(
  params: { page?: number; limit?: number },
  accessToken?: string | null,
) {
  const qs = buildQuery({ page: params.page ?? 1, limit: params.limit ?? 20 });
  const raw = await requestContentJson<unknown>(`${API_STORIES}${qs}`, {
    method: 'GET',
    headers: optionalBearer(accessToken),
  });
  return normalizeStoriesListFromWire(raw);
}

export async function getStory(storyId: string, accessToken?: string | null) {
  const id = encodeURIComponent(storyId.trim());
  const raw = await requestContentJson<unknown>(`${API_STORIES}/${id}`, {
    method: 'GET',
    headers: optionalBearer(accessToken),
  });
  return normalizeStoryFromWire(raw);
}

export async function createStory(accessToken: string, body: { body: string }) {
  const raw = await requestContentJson<unknown>(API_STORIES, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify(body),
  });
  return normalizeStoryFromWire(raw);
}

export async function getGallery() {
  return requestContentJson<unknown[]>(API_GALLERY, { method: 'GET' });
}

export async function getGalleryAlbum(albumId: string) {
  const id = encodeURIComponent(albumId.trim());
  return requestContentJson<unknown>(`${API_GALLERY}/${id}`, { method: 'GET' });
}

export async function getNews() {
  return requestContentJson<unknown[]>(API_NEWS, { method: 'GET' });
}

export async function getGifs(params: { q?: string; limit?: number }) {
  const qs = buildQuery({ q: params.q?.trim() || undefined, limit: params.limit ?? 18 });
  return requestContentJson<{ gifs?: GifSearchResult[]; error?: string }>(`${API_GIPHY}${qs}`, { method: 'GET' });
}

export async function getMembersPage(params: {
  page?: number;
  limit?: number;
  name?: string;
  country?: string;
  city?: string;
  joining?: boolean;
  contributed?: boolean;
  alpha?: boolean;
  ids?: string;
}) {
  const qs = buildQuery({
    page: params.page,
    limit: params.limit,
    name: params.name,
    country: params.country,
    city: params.city,
    joining: params.joining,
    contributed: params.contributed,
    alpha: params.alpha,
    ids: params.ids,
  });
  return requestContentJson<unknown>(`${API_MEMBERS}${qs}`, { method: 'GET' });
}

export async function searchMembers(params: { q: string; limit?: number }) {
  const qs = buildQuery({ q: params.q, limit: params.limit });
  return requestContentJson<unknown>(`${API_MEMBERS_SEARCH}${qs}`, { method: 'GET' });
}

export async function getMember(memberId: string) {
  const id = encodeURIComponent(memberId.trim());
  return requestContentJson<unknown>(`${API_MEMBERS}/${id}`, { method: 'GET' });
}

export async function getMemberTaggedPhotos(memberId: string) {
  const id = encodeURIComponent(memberId.trim());
  return requestContentJson<unknown>(`${API_MEMBERS}/${id}/photos`, { method: 'GET' });
}

export async function getBulkEngagement(
  entityType: ReactionEntityType,
  ids: string[],
  accessToken?: string | null,
) {
  const numericIds = ids
    .map((id) => normalizeEntityId(entityType, id))
    .filter((id, index, all) => all.indexOf(id) === index);
  if (numericIds.length === 0) return {} as Record<number, { reactionCount: number; commentCount: number; likedByMe: boolean }>;
  const qs = buildQuery({ entityType, ids: numericIds.join(',') });
  return requestContentJson<Record<number, { reactionCount: number; commentCount: number; likedByMe: boolean }>>(
    `${API_ENGAGEMENT}${qs}`,
    {
      method: 'GET',
      headers: optionalBearer(accessToken),
    },
  );
}

export async function getComments(params: {
  entityType: CommentableEntityType;
  entityId: string;
  page?: number;
  limit?: number;
}) {
  const entityId = normalizeEntityId(params.entityType, params.entityId);
  const qs = buildQuery({
    entityType: params.entityType,
    entityId,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  });
  return requestContentJson<unknown>(`${API_COMMENTS}${qs}`, { method: 'GET' });
}

export async function postComment(
  accessToken: string,
  body: { entityType: CommentableEntityType; entityId: string; body: string },
) {
  const wire = {
    entityType: body.entityType,
    entityId: normalizeEntityId(body.entityType, body.entityId),
    body: body.body,
  };
  return requestContentJson<unknown>(API_COMMENTS, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify(wire),
  });
}

export async function getReactions(
  params: { entityType: ReactionEntityType; entityId: string },
  accessToken?: string | null,
) {
  const entityId = normalizeEntityId(params.entityType, params.entityId);
  const qs = buildQuery({ entityType: params.entityType, entityId });
  return requestContentJson<unknown>(`${API_REACTIONS}${qs}`, {
    method: 'GET',
    headers: optionalBearer(accessToken),
  });
}

export async function postReactionToggle(accessToken: string, params: { entityType: ReactionEntityType; entityId: string }) {
  const wire = {
    entityType: params.entityType,
    entityId: normalizeEntityId(params.entityType, params.entityId),
  };
  const raw = await requestContentJson<unknown>(API_REACTIONS, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify(wire),
  });
  return mapReactionToggleFromWire(raw);
}

export async function getPolls(accessToken?: string | null) {
  return requestContentJson<unknown[]>(API_POLLS, {
    method: 'GET',
    headers: optionalBearer(accessToken),
  });
}

export async function postPollVote(accessToken: string, pollId: number, optionIds: number[]) {
  return requestContentJson<{ ok: boolean }>(`${API_POLLS}/${pollId}/vote`, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify({ optionIds }),
  });
}

export async function getSilverJubileeSchedule() {
  return requestContentJson<unknown[]>(API_SILVER_JUBILEE, { method: 'GET' });
}

export type StoryImageUploadPayload = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export async function postUploadMultipart(accessToken: string, payload: StoryImageUploadPayload) {
  const formData = new FormData();
  formData.append('file', {
    uri: payload.uri,
    name: payload.fileName,
    type: payload.mimeType,
  } as unknown as Blob);
  formData.append('filename', payload.fileName);

  const raw = await requestContentJson<unknown>(API_UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return mapUploadResponseFromWire(raw);
}

export async function postUploadPresign(
  accessToken: string,
  body: { filename: string; contentType: string },
) {
  const raw = await requestContentJson<unknown>(API_UPLOAD, {
    method: 'POST',
    headers: bearerJson(accessToken),
    body: JSON.stringify(body),
  });
  return mapUploadResponseFromWire(raw);
}

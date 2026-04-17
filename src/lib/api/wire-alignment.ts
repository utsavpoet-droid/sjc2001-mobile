/**
 * Pure-ish wire → app-model helpers for backend JSON (camelCase, numeric ids).
 * Keeps mappers testable without React Native or HTTP.
 */

import { resolveBackendUrl } from '@/lib/api/bases';

export type StoryAuthorWire = Record<string, unknown>;

export type StoryAuthorNormalized = {
  name: string;
  memberUserId: string;
  memberId?: string;
  avatarUrl?: string | null;
};

function maybeResolveUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || !value) return null;
  try {
    return resolveBackendUrl(value);
  } catch {
    return value;
  }
}

export function normalizeStoryAuthorFromWire(raw: unknown): StoryAuthorNormalized {
  if (!raw || typeof raw !== 'object') {
    return { name: '', memberUserId: '' };
  }
  const o = raw as StoryAuthorWire;
  const uid = o.memberUserId;
  return {
    name: String(o.name ?? ''),
    memberUserId:
      typeof uid === 'number' || typeof uid === 'string' ? String(uid) : '',
    memberId: o.memberId != null ? String(o.memberId) : undefined,
    avatarUrl: maybeResolveUrl(o.avatarUrl),
  };
}

export type PostReactionWire = Record<string, unknown>;

export type PostReactionNormalized = {
  reactionCount: number;
  likedByMe: boolean;
};

/** Backend may return `{ liked, count }` or `{ likedByMe, reactionCount }`. */
export function mapReactionToggleFromWire(raw: unknown): PostReactionNormalized {
  const o = (raw && typeof raw === 'object' ? raw : {}) as PostReactionWire;
  const liked =
    typeof o.liked === 'boolean'
      ? o.liked
      : typeof o.likedByMe === 'boolean'
        ? o.likedByMe
        : false;
  const count =
    typeof o.count === 'number'
      ? o.count
      : typeof o.reactionCount === 'number'
        ? o.reactionCount
        : 0;
  return { likedByMe: liked, reactionCount: count };
}

export type UploadWire = Record<string, unknown>;

/**
 * Multipart and presign both return `publicUrl` + `proxyUrl`.
 * Prefer **proxyUrl** then **publicUrl** (site-relative proxy is canonical for in-app display when present).
 */
export function mapUploadResponseFromWire(raw: unknown): { url: string } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as UploadWire;
  const proxy = o.proxyUrl;
  const pub = o.publicUrl;
  const legacy = o.url;
  const pick =
    (typeof proxy === 'string' && proxy) ||
    (typeof pub === 'string' && pub) ||
    (typeof legacy === 'string' && legacy) ||
    '';
  return { url: pick };
}

/** Backend comment/reaction `entityId` for stories is numeric in examples; coerce from string id. */
export function storyEntityIdAsNumber(storyId: string): number {
  const n = Number(String(storyId).trim());
  if (!Number.isFinite(n)) {
    throw new Error('Invalid story id for entityId');
  }
  return n;
}

export type MemberListWire = Record<string, unknown>;

export type MemberSummaryNormalized = {
  id: string;
  display_name: string;
  avatar_url: string | null | undefined;
  avatar_focal_x?: number;
  avatar_focal_y?: number;
  city?: string;
  country?: string;
  location_label?: string;
};

/** List/search wire: `name`, `photoUrl`, optional `photos[0].photoUrl` for avatar. */
export function mapMemberSummaryFromWire(w: MemberListWire): MemberSummaryNormalized {
  const photos = (w.photos as { photoUrl?: string }[] | undefined) ?? [];
  const avatarFromPhoto = photos[0]?.photoUrl;
  const city = typeof w.city === 'string' ? w.city : '';
  const country = typeof w.country === 'string' ? w.country : '';
  return {
    id: String(w.id ?? w.memberId ?? ''),
    display_name: String(w.display_name ?? w.name ?? w.displayName ?? ''),
    avatar_url: maybeResolveUrl(
      w.avatar_url ?? w.avatarUrl ?? w.photoUrl ?? avatarFromPhoto ?? null,
    ),
    avatar_focal_x: typeof w.avatarFocalX === 'number' ? w.avatarFocalX : 50,
    avatar_focal_y: typeof w.avatarFocalY === 'number' ? w.avatarFocalY : 50,
    city,
    country,
    location_label: [city, country].filter(Boolean).join(', '),
  };
}

/** Member detail has no `avatarUrl`; same derivation as list (`photos[0]?.photoUrl`). */
export function mapMemberDetailFromWire(w: MemberListWire): MemberSummaryNormalized & {
  bioFromComments: string | null | undefined;
  email?: string;
  phone?: string;
  birthday?: string | null;
  isJoining?: boolean;
  contributionAmount?: string;
  photo_urls: string[];
  avatar_focal_x?: number;
  avatar_focal_y?: number;
} {
  const base = mapMemberSummaryFromWire(w);
  const comments = w.comments;
  const bioFromComments =
    comments === undefined || comments === null
      ? undefined
      : typeof comments === 'string'
        ? comments
        : String(comments);
  const photos = Array.isArray(w.photos) ? w.photos : [];
  const photo_urls = photos
    .map((photo) => maybeResolveUrl((photo as { photoUrl?: unknown }).photoUrl))
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  return {
    ...base,
    bioFromComments,
    email: typeof w.email === 'string' ? w.email : undefined,
    phone: typeof w.phone === 'string' ? w.phone : undefined,
    birthday: typeof w.birthday === 'string' ? w.birthday : null,
    isJoining: typeof w.isJoining === 'boolean' ? w.isJoining : undefined,
    contributionAmount:
      w.contributionAmount === undefined || w.contributionAmount === null
        ? undefined
        : String(w.contributionAmount),
    photo_urls,
    avatar_focal_x: base.avatar_focal_x,
    avatar_focal_y: base.avatar_focal_y,
  };
}

export type StoryNormalized = {
  id: string;
  body: string;
  isPinned: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  author: StoryAuthorNormalized;
  reactionCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export function normalizeStoryFromWire(raw: unknown): StoryNormalized {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    body: String(o.body ?? ''),
    isPinned: Boolean(o.isPinned),
    isHidden: Boolean(o.isHidden),
    createdAt: String(o.createdAt ?? ''),
    updatedAt: String(o.updatedAt ?? ''),
    author: normalizeStoryAuthorFromWire(o.author),
    reactionCount: Number(o.reactionCount ?? 0),
    commentCount: Number(o.commentCount ?? 0),
    likedByMe: Boolean(o.likedByMe),
  };
}

export function normalizeStoriesListFromWire(raw: unknown): {
  stories: StoryNormalized[];
  total: number;
} {
  const o = raw as { stories?: unknown[]; total?: number };
  return {
    stories: (o.stories ?? []).map((s) => normalizeStoryFromWire(s)),
    total: typeof o.total === 'number' ? o.total : 0,
  };
}

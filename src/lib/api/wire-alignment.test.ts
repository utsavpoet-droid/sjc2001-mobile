import {
  mapMemberDetailFromWire,
  mapMemberSummaryFromWire,
  mapReactionToggleFromWire,
  mapUploadResponseFromWire,
  normalizeStoriesListFromWire,
  normalizeStoryAuthorFromWire,
  normalizeStoryFromWire,
  storyEntityIdAsNumber,
} from './wire-alignment';

const originalV1 = process.env.EXPO_PUBLIC_API_BASE_URL;
const originalContent = process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL;

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://host.example/api/v1';
  process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL = 'https://host.example/api';
});

afterAll(() => {
  if (originalV1 === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = originalV1;
  }

  if (originalContent === undefined) {
    delete process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL = originalContent;
  }
});

describe('normalizeStoryAuthorFromWire', () => {
  it('coerces numeric memberUserId to string', () => {
    expect(
      normalizeStoryAuthorFromWire({
        name: 'Jane',
        memberUserId: 12,
        memberId: 34,
        avatarUrl: 'https://cdn/x.jpg',
      }),
    ).toEqual({
      name: 'Jane',
      memberUserId: '12',
      memberId: '34',
      avatarUrl: 'https://cdn/x.jpg',
    });
  });

  it('resolves relative avatar urls', () => {
    expect(
      normalizeStoryAuthorFromWire({
        name: 'Jane',
        memberUserId: 12,
        avatarUrl: '/api/img?v=1',
      }),
    ).toMatchObject({ avatarUrl: 'https://host.example/api/img?v=1' });
  });

  it('handles empty input', () => {
    expect(normalizeStoryAuthorFromWire(null)).toEqual({
      name: '',
      memberUserId: '',
    });
  });
});

describe('mapReactionToggleFromWire', () => {
  it('maps backend { liked, count }', () => {
    expect(mapReactionToggleFromWire({ liked: true, count: 9 })).toEqual({
      likedByMe: true,
      reactionCount: 9,
    });
  });

  it('maps legacy { likedByMe, reactionCount }', () => {
    expect(
      mapReactionToggleFromWire({ likedByMe: false, reactionCount: 3 }),
    ).toEqual({
      likedByMe: false,
      reactionCount: 3,
    });
  });
});

describe('mapUploadResponseFromWire', () => {
  it('prefers proxyUrl over publicUrl', () => {
    expect(
      mapUploadResponseFromWire({
        publicUrl: 'https://blob/a.jpg',
        proxyUrl: '/api/img?v=1',
      }),
    ).toEqual({ url: '/api/img?v=1' });
  });

  it('falls back to publicUrl when no proxy', () => {
    expect(
      mapUploadResponseFromWire({
        publicUrl: 'https://blob/a.jpg',
      }),
    ).toEqual({ url: 'https://blob/a.jpg' });
  });

  it('falls back to legacy url', () => {
    expect(mapUploadResponseFromWire({ url: 'https://x' })).toEqual({
      url: 'https://x',
    });
  });
});

describe('storyEntityIdAsNumber', () => {
  it('parses numeric story id', () => {
    expect(storyEntityIdAsNumber('123')).toBe(123);
  });

  it('throws on invalid id', () => {
    expect(() => storyEntityIdAsNumber('x')).toThrow();
  });
});

describe('normalizeStoryFromWire / list', () => {
  it('normalizes full story', () => {
    const s = normalizeStoryFromWire({
      id: 101,
      body: 'Hi',
      isPinned: false,
      isHidden: false,
      createdAt: 't1',
      updatedAt: 't2',
      author: { name: 'A', memberUserId: 12 },
      reactionCount: 1,
      commentCount: 2,
      likedByMe: true,
    });
    expect(s.id).toBe('101');
    expect(s.author.memberUserId).toBe('12');
    expect(s.likedByMe).toBe(true);
  });

  it('normalizes list wrapper', () => {
    const list = normalizeStoriesListFromWire({
      stories: [{ id: 1, body: 'b', isPinned: false, isHidden: false, createdAt: '', updatedAt: '', author: { name: '', memberUserId: 1 }, reactionCount: 0, commentCount: 0, likedByMe: false }],
      total: 1,
    });
    expect(list.total).toBe(1);
    expect(list.stories[0].id).toBe('1');
  });
});

describe('mapMemberSummaryFromWire', () => {
  it('uses photoUrl from search result', () => {
    expect(
      mapMemberSummaryFromWire({
        id: 1,
        name: 'A',
        city: 'Agra',
        country: 'India',
        photoUrl: 'https://p.jpg',
      }),
    ).toMatchObject({
      id: '1',
      display_name: 'A',
      avatar_url: 'https://p.jpg',
      location_label: 'Agra, India',
    });
  });

  it('derives avatar from photos[0] when no photoUrl', () => {
    expect(
      mapMemberSummaryFromWire({
        id: 2,
        name: 'B',
        photos: [{ photoUrl: '/uploads/m.jpg', sortOrder: 0 }],
      }),
    ).toMatchObject({
      id: '2',
      avatar_url: 'https://host.example/uploads/m.jpg',
    });
  });
});

describe('mapMemberDetailFromWire', () => {
  it('maps comments field to bioFromComments', () => {
    const m = mapMemberDetailFromWire({
      id: 2,
      name: 'B',
      city: 'Delhi',
      country: 'India',
      comments: 'Hello',
      photos: [{ photoUrl: '/api/img?v=2' }],
    });
    expect(m.bioFromComments).toBe('Hello');
    expect(m.location_label).toBe('Delhi, India');
    expect(m.photo_urls[0]).toBe('https://host.example/api/img?v=2');
  });
});

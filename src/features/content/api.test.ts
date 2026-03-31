import { getStoriesPage } from './api';

describe('content api', () => {
  const origFetch = global.fetch;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://t.example/api/v1';
    process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL = 'https://t.example/api';
  });

  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
  });

  afterAll(() => {
    global.fetch = origFetch;
  });

  it('GET /stories uses content /api base, not /api/v1', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          stories: [],
          total: 0,
        }),
    });

    await getStoriesPage({ page: 1, limit: 10 });

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url.startsWith('https://t.example/api/stories')).toBe(true);
    expect(url).not.toContain('/v1');
  });
});

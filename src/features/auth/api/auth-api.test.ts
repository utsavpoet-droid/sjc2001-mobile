import { postMobileLogin, postMobileRefresh, getMobileMe } from './auth-api';

describe('auth-api', () => {
  const origFetch = global.fetch;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://t.example/api/v1';
  });

  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
  });

  afterAll(() => {
    global.fetch = origFetch;
  });

  it('postMobileLogin POSTs identifier and unwraps data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            accessToken: 'a',
            refreshToken: 'r',
            expiresIn: 900,
            user: {
              id: 1,
              role: 'member',
              memberId: 2,
              name: 'N',
              avatarUrl: null,
            },
          },
        }),
    });

    const out = await postMobileLogin({
      identifier: 'u@x.com',
      password: 'p',
    });

    expect(out).toMatchObject({ accessToken: 'a', refreshToken: 'r' });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://t.example/api/v1/auth/mobile/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      identifier: 'u@x.com',
      password: 'p',
    });
  });

  it('postMobileRefresh sends refreshToken key', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            accessToken: 'a2',
            refreshToken: 'r2',
            expiresIn: 900,
            user: {
              id: 1,
              role: 'member',
              memberId: 2,
              name: 'N',
              avatarUrl: null,
            },
          },
        }),
    });

    await postMobileRefresh({ refreshToken: 'r' });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'r' });
  });

  it('postMobileLogin includes totpCode when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            accessToken: 'a3',
            refreshToken: 'r3',
            expiresIn: 900,
            user: {
              id: 1,
              role: 'member',
              memberId: 2,
              name: 'N',
              avatarUrl: null,
            },
          },
        }),
    });

    await postMobileLogin({
      identifier: 'u@x.com',
      password: 'p',
      totpCode: '123456',
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      identifier: 'u@x.com',
      password: 'p',
      totpCode: '123456',
    });
  });

  it('getMobileMe uses Bearer access token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            id: 1,
            role: 'member',
            memberId: 2,
            name: 'N',
            avatarUrl: null,
          },
        }),
    });

    const me = await getMobileMe('atoken');
    expect(me.name).toBe('N');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer atoken');
  });
});

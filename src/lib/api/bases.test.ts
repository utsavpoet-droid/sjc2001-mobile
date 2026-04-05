import { deriveContentBaseFromV1Base, joinBasePath, resolveBackendUrl, resolveResponsiveImageUrl } from './bases';

describe('deriveContentBaseFromV1Base', () => {
  it('strips /api/v1 suffix', () => {
    expect(deriveContentBaseFromV1Base('https://host/api/v1')).toBe('https://host/api');
    expect(deriveContentBaseFromV1Base('https://host/api/v1/')).toBe('https://host/api');
  });
});

describe('joinBasePath', () => {
  it('joins base and path', () => {
    expect(joinBasePath('https://h/api', '/stories')).toBe('https://h/api/stories');
  });
});

describe('resolveBackendUrl', () => {
  const originalV1 = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalContent = process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/api/v1';
    process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL = 'http://localhost:3000/api';
  });

  afterAll(() => {
    if (originalV1 === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalV1;
    if (originalContent === undefined) delete process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL;
    else process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL = originalContent;
  });

  it('keeps absolute urls and normalizes localhost for native image loading', () => {
    expect(resolveBackendUrl('http://localhost:3000/a.jpg')).toBe('http://127.0.0.1:3000/a.jpg');
  });

  it('resolves site-relative urls against the site base', () => {
    expect(resolveBackendUrl('/api/img?v=123')).toBe('http://127.0.0.1:3000/api/img?v=123');
    expect(resolveBackendUrl('/logo.png')).toBe('http://127.0.0.1:3000/logo.png');
  });
});

describe('resolveResponsiveImageUrl', () => {
  beforeAll(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/api/v1';
    process.env.EXPO_PUBLIC_API_CONTENT_BASE_URL = 'http://localhost:3000/api';
  });

  it('adds width and quality params for proxied image urls', () => {
    expect(resolveResponsiveImageUrl('/api/img?v=123', { width: 800, quality: 75 })).toBe(
      'http://127.0.0.1:3000/api/img?v=123&w=800&q=75',
    );
  });

  it('leaves non-proxy urls unchanged apart from base resolution', () => {
    expect(resolveResponsiveImageUrl('/logo.png', { width: 800, quality: 75 })).toBe(
      'http://127.0.0.1:3000/logo.png',
    );
  });
});

import { displayTextFromMarkup, extractMediaFromMarkup } from './markup';

describe('displayTextFromMarkup', () => {
  it('turns mention tokens into readable text', () => {
    expect(displayTextFromMarkup('Hi @[Jane Doe](member:12)')).toBe('Hi @Jane Doe');
  });

  it('removes media tokens from display text', () => {
    expect(displayTextFromMarkup('Hello\n![gif](/api/giphy/x)')).toBe('Hello');
  });

  it('removes gif media tokens that include query strings', () => {
    expect(
      displayTextFromMarkup(
        "What's up?\n![gif](/api/giphy/media?src=https%3A%2F%2Fmedia3.giphy.com%2Fmedia%2Fabc123%2Fgiphy.gif)",
      ),
    ).toBe("What's up?");
  });
});

describe('extractMediaFromMarkup', () => {
  it('extracts image and gif urls in order by type scan', () => {
    expect(extractMediaFromMarkup('x ![image](/a.jpg) y ![gif](/g.gif)')).toEqual([
      { type: 'image', url: '/a.jpg' },
      { type: 'gif', url: '/g.gif' },
    ]);
  });

  it('extracts gif urls with encoded remote sources', () => {
    expect(
      extractMediaFromMarkup(
        '![gif](/api/giphy/media?src=https%3A%2F%2Fmedia3.giphy.com%2Fmedia%2Fabc123%2Fgiphy.gif)',
      ),
    ).toEqual([
      {
        type: 'gif',
        url: '/api/giphy/media?src=https%3A%2F%2Fmedia3.giphy.com%2Fmedia%2Fabc123%2Fgiphy.gif',
      },
    ]);
  });
});

export type StoryMediaPart = {
  type: 'image' | 'gif';
  url: string;
};

const MENTION_PATTERN = /@\[([^\]]+)\]\(member:(\d+)\)/g;
const MEDIA_PATTERN = /!\[(image|gif)\]\((.+?)\)/g;

export function displayTextFromMarkup(body: string): string {
  return body
    .replace(MENTION_PATTERN, '@$1')
    .replace(MEDIA_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractMediaFromMarkup(body: string): StoryMediaPart[] {
  const parts: StoryMediaPart[] = [];
  for (const match of body.matchAll(MEDIA_PATTERN)) {
    const mediaType = match[1];
    const url = match[2]?.trim();
    if (!url || (mediaType !== 'image' && mediaType !== 'gif')) continue;
    parts.push({ type: mediaType, url });
  }
  return parts;
}

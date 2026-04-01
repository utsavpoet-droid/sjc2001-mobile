const GIF_TOKEN_REGEX = /!\[gif\]\(([^)]+)\)/g;

export function extractGifUrls(body: string) {
  return [...body.matchAll(GIF_TOKEN_REGEX)]
    .map((match) => match[1]?.trim())
    .filter((url): url is string => Boolean(url));
}

export function stripGifTokens(body: string) {
  return body.replace(GIF_TOKEN_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function serializeComposerBody(text: string, gifUrls: string[]) {
  const trimmedText = text.trim();
  const attachmentLines = gifUrls.map((url) => `![gif](${url})`);

  if (trimmedText && attachmentLines.length > 0) {
    return `${trimmedText}\n${attachmentLines.join('\n')}`;
  }
  if (attachmentLines.length > 0) {
    return attachmentLines.join('\n');
  }
  return trimmedText;
}

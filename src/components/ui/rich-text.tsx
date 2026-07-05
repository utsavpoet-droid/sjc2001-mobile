import { Image } from 'expo-image';
import React, { type ReactNode } from 'react';
import { Linking, type StyleProp, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { resolveBackendUrl } from '@/lib/api/bases';

/**
 * Lightweight Markdown-lite renderer for React Native, matching the website's
 * `RichText` component so poll/news descriptions look the same on both surfaces.
 * Supports: paragraphs, line breaks, bullet/ordered lists, **bold**, *italic*,
 * `code`, [links](url), and ![images](url) (block when alone on a line, inline
 * otherwise — inline images are promoted to their own block since RN cannot nest
 * <Image> inside <Text>).
 */

type RichTextProps = {
  text?: string | null;
  color?: string;
  linkColor?: string;
  style?: StyleProp<TextStyle>;
};

const IMAGE_TOKEN = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
const INLINE_TOKEN = /(\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function renderInline(text: string, keyBase: string, color: string, linkColor: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_TOKEN.lastIndex = 0;

  while ((m = INLINE_TOKEN.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];

    if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link) {
        out.push(
          <Text
            key={`${keyBase}-a-${m.index}`}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => {
              void Linking.openURL(link[2]);
            }}>
            {link[1]}
          </Text>,
        );
      } else {
        out.push(token);
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
      out.push(
        <Text key={`${keyBase}-b-${m.index}`} style={styles.bold}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      out.push(
        <Text key={`${keyBase}-i-${m.index}`} style={styles.italic}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      out.push(
        <Text key={`${keyBase}-c-${m.index}`} style={styles.code}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else {
      out.push(token);
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, color = '#111827', linkColor = '#2563eb', style }: RichTextProps) {
  if (!text || !text.trim()) return null;

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  function pushImage(url: string) {
    blocks.push(
      <Image
        key={`img-${blocks.length}`}
        source={{ uri: resolveBackendUrl(url) ?? url }}
        style={styles.image}
        contentFit="contain"
        transition={150}
      />,
    );
  }

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const joined = paragraph.join('\n');
    paragraph = [];

    // Split out any inline image tokens into their own blocks; render the text
    // runs between them as paragraphs.
    let last = 0;
    let m: RegExpExecArray | null;
    IMAGE_TOKEN.lastIndex = 0;
    const before = blocks.length;
    while ((m = IMAGE_TOKEN.exec(joined)) !== null) {
      const textRun = joined.slice(last, m.index);
      if (textRun.trim()) pushParagraphText(textRun);
      pushImage(m[1]);
      last = m.index + m[0].length;
    }
    const tail = joined.slice(last);
    if (tail.trim() || before === blocks.length) pushParagraphText(tail);
  }

  function pushParagraphText(value: string) {
    if (!value.trim()) return;
    const textLines = value.split('\n');
    blocks.push(
      <Text key={`p-${blocks.length}`} style={[styles.paragraph, { color }, style]}>
        {textLines.map((line, i) => (
          <Text key={i}>
            {i > 0 ? '\n' : null}
            {renderInline(line, `p-${blocks.length}-${i}`, color, linkColor)}
          </Text>
        ))}
      </Text>,
    );
  }

  function flushList() {
    if (listItems.length === 0) return;
    const items = listItems;
    const ordered = listType === 'ol';
    listItems = [];
    listType = null;
    blocks.push(
      <View key={`list-${blocks.length}`} style={styles.list}>
        {items.map((item, idx) => (
          <View key={idx} style={styles.listRow}>
            <Text style={[styles.bullet, { color }]}>{ordered ? `${idx + 1}.` : '•'}</Text>
            <Text style={[styles.paragraph, styles.listText, { color }, style]}>
              {renderInline(item, `li-${blocks.length}-${idx}`, color, linkColor)}
            </Text>
          </View>
        ))}
      </View>,
    );
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    const imageOnly = trimmed.match(/^!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)$/);
    if (imageOnly) {
      flushParagraph();
      flushList();
      pushImage(imageOnly[1]);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);

    if (bullet) {
      flushParagraph();
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(bullet[1]);
      continue;
    }
    if (ordered) {
      flushParagraph();
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(ordered[1]);
      continue;
    }
    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return <View style={styles.container}>{blocks}</View>;
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 13,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: 'rgba(120,120,120,0.08)',
  },
  list: {
    gap: 4,
  },
  listRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
  },
  listText: {
    flex: 1,
  },
});

export default RichText;

import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';
import { displayTextFromMarkup, extractMediaFromMarkup } from '@/lib/content/markup';

export function RichBody({
  body,
  textStyle,
  style,
}: {
  body: string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const displayText = displayTextFromMarkup(body);
  const media = extractMediaFromMarkup(body);

  return (
    <View style={[styles.stack, style]}>
      {displayText ? (
        <Text style={[styles.bodyText, { color: colors.textSecondary }, textStyle]}>{displayText}</Text>
      ) : null}
      {media.map((item, index) => {
        const uri = resolveBackendUrl(item.url);
        if (!uri) return null;
        return (
          <Image
            key={`${item.type}-${item.url}-${index}`}
            source={{ uri }}
            style={[styles.media, item.type === 'gif' ? styles.gif : styles.image]}
            resizeMode="cover"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
  },
  bodyText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  media: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  image: {
    height: 220,
  },
  gif: {
    height: 180,
  },
});

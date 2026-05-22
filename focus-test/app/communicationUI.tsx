import React from "react";
import { Image, Platform, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import type { SessionOption } from "./communicationHelpers";
import { styles } from "./communicationCommon";

interface OptionCardProps {
  option: SessionOption;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onPress?: (option: SessionOption) => void;
}

function isSvgUrl(url?: string | null) {
  return !!url && url.toLowerCase().split("?")[0].endsWith(".svg");
}

function SvgImageView({
  uri,
  compact,
  onError,
}: {
  uri: string;
  compact?: boolean;
  onError: () => void;
}) {
  const size = compact ? 40 : 58;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            overflow: hidden;
          }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${uri}" />
      </body>
    </html>
  `;

  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        backgroundColor: "transparent",
      }}
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{
          width: size,
          height: size,
          backgroundColor: "transparent",
        }}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onError={onError}
      />
    </View>
  );
}

function OptionVisual({
  option,
  compact,
}: {
  option: SessionOption;
  compact?: boolean;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [option.imageUrl]);

  const shouldShowImage = !!option.imageUrl && !imageFailed;
  const isSvg = isSvgUrl(option.imageUrl);

  return (
    <View style={[styles.optionVisualBox, compact && styles.optionVisualBoxCompact]}>
      {shouldShowImage ? (
        isSvg && Platform.OS !== "web" ? (
          <SvgImageView
            uri={option.imageUrl as string}
            compact={compact}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Image
            source={{ uri: option.imageUrl as string }}
            style={[styles.optionImage, compact && styles.optionImageCompact]}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        )
      ) : (
        <Text style={[styles.optionEmoji, compact && styles.optionEmojiCompact]}>
          {option.emoji ?? "✨"}
        </Text>
      )}
    </View>
  );
}

export function OptionCard({
  option,
  selected = false,
  compact = false,
  disabled = false,
  onPress,
}: OptionCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled || !onPress}
      onPress={() => onPress?.(option)}
      style={[
        styles.optionCard,
        compact && styles.optionCardCompact,
        selected && styles.optionCardSelected,
      ]}
    >
      <OptionVisual option={option} compact={compact} />

      <View style={styles.optionTextWrap}>
        <Text
          style={[styles.optionLabel, compact && styles.optionLabelCompact]}
          numberOfLines={compact ? 2 : 3}
        >
          {option.label}
        </Text>
      </View>

      {selected ? (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function Header({ title, subtitle, onBack }: HeaderProps) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerTextBlock}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>

      {onBack ? (
        <TouchableOpacity style={styles.textButton} onPress={onBack}>
          <Text style={styles.textButtonLabel}>Change mode</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default null;
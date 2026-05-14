import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import type { SessionOption } from "./communicationHelpers";
import { styles } from "./communicationCommon";

interface OptionCardProps {
  option: SessionOption;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onPress?: (option: SessionOption) => void;
}

export function OptionCard({
  option,
  selected = false,
  compact = false,
  disabled = false,
  onPress,
}: OptionCardProps) {
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [option.imageUrl]);

  const shouldShowImage = !!option.imageUrl && !imageFailed;

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
      {shouldShowImage ? (
        <Image
          source={{ uri: option.imageUrl }}
          style={[styles.optionImage, compact && styles.optionImageCompact]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={[styles.optionEmoji, compact && styles.optionEmojiCompact]}>
          {option.emoji ?? "✨"}
        </Text>
      )}

      <View style={styles.optionTextWrap}>
        <Text style={[styles.optionLabel, compact && styles.optionLabelCompact]}>
          {option.label}
        </Text>
      </View>

      {selected && <View style={styles.selectedDot} />}
    </TouchableOpacity>
  );
}
interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function Header({ title, subtitle, onBack }: HeaderProps) {
  // Reusable header that shows the current screen title and optional mode-switch action.
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerTextBlock}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        ) : null}
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

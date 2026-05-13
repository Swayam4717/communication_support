import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
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
  // Shared choice card used both in the parent preview and in the child's answer picker.
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
      <Text style={[styles.optionEmoji, compact && styles.optionEmojiCompact]}>
        {option.emoji}
      </Text>
      <Text style={[styles.optionLabel, compact && styles.optionLabelCompact]}>
        {option.label}
      </Text>
      {selected ? <View style={styles.selectionDot} /> : null}
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

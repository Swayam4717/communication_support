import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ChildStage = "idle" | "incoming" | "choice" | "confirmation";

export interface SessionOption {
  id: string;
  label: string;
  emoji: string;
}

export interface SentSession {
  id: string;
  question: string;
  options: SessionOption[];
  createdAt: number;
}

export const DEFAULT_QUESTION = "What would you like to eat?";
export const DEFAULT_OPTIONS = ["Rice", "Noodles", "Pizza", "Sandwich"];
export const FALLBACK_EMOJIS = ["🌿", "☁️", "✨", "🫧"];

export function getEmojiForLabel(label: string, index: number) {
  const normalized = label.trim().toLowerCase();
  const emojiMap: Record<string, string> = {
    rice: "🍚",
    noodles: "🍜",
    pizza: "🍕",
    sandwich: "🥪",
    happy: "😀",
    sad: "😔",
    angry: "😡",
    tired: "😴",
  };

  return emojiMap[normalized] ?? FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length];
}

export function buildSessionOptions(optionLabels: string[]): SessionOption[] {
  return optionLabels.map((label, index) => {
    const cleanedLabel = label.trim() || `Option ${index + 1}`;

    return {
      id: String(index + 1),
      label: cleanedLabel,
      emoji: getEmojiForLabel(cleanedLabel, index),
    };
  });
}

export function createSession(question: string, optionLabels: string[]): SentSession {
  return {
    id: String(Date.now()),
    question: question.trim() || DEFAULT_QUESTION,
    options: buildSessionOptions(optionLabels),
    createdAt: Date.now(),
  };
}

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

export const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: "#FBF7F1",
  },
  flexFill: {
    flex: 1,
  },
  selectScreenWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modeSelectContainer: {
    gap: 16,
  },
  modeHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  modeHeroEmoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  modeHeroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#2B1D18",
    textAlign: "center",
    marginBottom: 8,
  },
  modeHeroSubtitle: {
    fontSize: 16,
    color: "#7E6F67",
    textAlign: "center",
    lineHeight: 22,
  },
  modeButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#E7DED6",
    minHeight: 132,
    justifyContent: "center",
  },
  modeButtonEmoji: {
    fontSize: 34,
    marginBottom: 10,
  },
  modeButtonTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2B1D18",
    marginBottom: 6,
  },
  modeButtonSubtitle: {
    fontSize: 15,
    color: "#7E6F67",
    lineHeight: 21,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 32 : 24,
    paddingBottom: 28,
    gap: 16,
  },
  parentScrollContent: {
    paddingBottom: 140,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2B1D18",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#7E6F67",
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F1E8DD",
  },
  textButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#705642",
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E7DED6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#A17655",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2B1D18",
    marginBottom: 8,
  },
  statusBody: {
    fontSize: 16,
    color: "#7E6F67",
    lineHeight: 22,
  },
  answerBadge: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5EBDD",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  answerBadgeEmoji: {
    fontSize: 24,
  },
  answerBadgeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B4F36",
  },
  panelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E7DED6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  textInput: {
    backgroundColor: "#FBF9F6",
    borderWidth: 1,
    borderColor: "#E3D8CE",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#2B1D18",
    minHeight: 56,
    marginBottom: 8,
  },
  optionsLabel: {
    marginTop: 14,
  },
  parentOptionsList: {
    gap: 10,
  },
  parentOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  parentOptionNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1E8DD",
    color: "#705642",
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 34,
    fontWeight: "700",
  },
  optionInput: {
    flex: 1,
    backgroundColor: "#FBF9F6",
    borderWidth: 1,
    borderColor: "#E3D8CE",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#2B1D18",
  },
  actionRow: {
    marginTop: 18,
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: "#F1E8DD",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#705642",
  },
  primaryButton: {
    backgroundColor: "#CFA87A",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButtonDisabled: {
    backgroundColor: "#E8DED4",
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E7DED6",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  previewQuestion: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2B1D18",
    marginBottom: 14,
  },
  previewGrid: {
    gap: 10,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E7DED6",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  heroEmoji: {
    fontSize: 54,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2B1D18",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#7E6F67",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 22,
  },
  confirmationEmoji: {
    fontSize: 72,
    marginVertical: 20,
  },
  choiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E7DED6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  questionTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2B1D18",
    marginBottom: 18,
  },
  choiceList: {
    gap: 12,
    marginBottom: 18,
  },
  optionCard: {
    backgroundColor: "#FBF9F6",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#E4D8CC",
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  optionCardCompact: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  optionCardSelected: {
    backgroundColor: "#F5EBDD",
    borderColor: "#CFA87A",
  },
  optionEmoji: {
    fontSize: 42,
    marginRight: 14,
  },
  optionEmojiCompact: {
    fontSize: 30,
    marginRight: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#2B1D18",
  },
  optionLabelCompact: {
    fontSize: 16,
  },
  selectionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#CFA87A",
    marginLeft: 8,
  },
  setupContainer: {
    gap: 20,
  },
  setupHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  setupHeroEmoji: {
    fontSize: 54,
    marginBottom: 16,
  },
  setupHeroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#2B1D18",
    textAlign: "center",
    marginBottom: 8,
  },
  setupHeroSubtitle: {
    fontSize: 16,
    color: "#7E6F67",
    textAlign: "center",
    lineHeight: 22,
  },
  roleButtonsContainer: {
    gap: 12,
  },
  roleButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "#E7DED6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  roleButtonSelected: {
    borderColor: "#CFA87A",
    backgroundColor: "#F5EBDD",
  },
  roleButtonEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  roleButtonTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2B1D18",
    marginBottom: 6,
  },
  roleButtonSubtitle: {
    fontSize: 14,
    color: "#7E6F67",
  },
  setupActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputHint: {
    fontSize: 12,
    color: "#9B8A7E",
    marginTop: 8,
  },
  settingsButton: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFE4D6",
    borderWidth: 1,
    borderColor: "#E7BFA8",
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B4513",
  },
});

export default null;

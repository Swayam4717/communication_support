import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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

  return (
    emojiMap[normalized] ?? FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length]
  );
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

export function createSession(
  question: string,
  optionLabels: string[],
): SentSession {
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
  onboardingScrollContent: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 680 : undefined,
    alignSelf: "center",
  },
  parentScrollContent: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 620 : undefined,
    alignSelf: "center",
    paddingHorizontal: Platform.OS === "web" ? 20 : 16,
    paddingTop: 18,
    paddingBottom: 36,
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
  parentOptionIndexBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1E8DD",
    position: "relative",
    overflow: "hidden",
  },
  parentOptionIndexInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E7DED6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  questionTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#2B1D18",
    lineHeight: 27,
    marginBottom: 6,
  },
  choiceInstructionText: {
    color: "#7E6F67",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 12,
  },
  choiceList: {
    gap: 9,
    marginBottom: 12,
  },
  speechPracticeCard: {
    backgroundColor: "#FBF9F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4D8CC",
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 2,
    gap: 7,
  },
  speechPracticeTitle: {
    color: "#2B1D18",
    fontSize: 15,
    fontWeight: "800",
  },
  speechPracticeHint: {
    color: "#7E6F67",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  speechSupportBoard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  speechSupportChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCCABE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  speechSupportChipSelected: {
    backgroundColor: "#F0DDC8",
    borderColor: "#B9824F",
  },
  speechSupportChipText: {
    color: "#705642",
    fontSize: 13,
    fontWeight: "800",
  },
  speechListenButton: {
    backgroundColor: "#CFA87A",
    borderRadius: 12,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  speechListenButtonActive: {
    backgroundColor: "#9B5E3E",
  },
  speechListenButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  speechLiveTranscript: {
    color: "#2B1D18",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  speechFallbackLabel: {
    color: "#806B5E",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  speechTranscriptInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3D8CE",
    borderRadius: 14,
    color: "#2B1D18",
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  speechPracticeMessage: {
    color: "#6F5D52",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  speechErrorText: {
    color: "#9B5E3E",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  selectedAnswerPanel: {
    backgroundColor: "#FBF9F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCCABE",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  selectedAnswerPanelEmpty: {
    backgroundColor: "#FBF9F6",
    borderColor: "#E4D8CC",
  },
  selectedAnswerLabel: {
    color: "#806B5E",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  selectedAnswerText: {
    color: "#2B1D18",
    fontSize: 16,
    fontWeight: "800",
  },
  optionCard: {
    backgroundColor: "#FBF9F6",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E4D8CC",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 82,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  optionCardCompact: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 76,
  },
  optionCardSelected: {
    backgroundColor: "#F5EBDD",
    borderColor: "#B9824F",
    borderWidth: 3,
  },
  selectionDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#B9824F",
    marginLeft: 12,
  },
  optionVisualBox: {
    width: 56,
    height: 56,
    minWidth: 56,
    maxWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
    resizeMode: "contain",
  },
  optionVisualBoxCompact: {
    width: 52,
    height: 52,
    minWidth: 52,
    maxWidth: 52,
    marginRight: 10,
    resizeMode: "contain",
  },
  optionImage: {
    width: 48,
    height: 48,
    resizeMode: "contain",
  },
  optionImageCompact: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  optionEmoji: {
    fontSize: 30,
    textAlign: "center",
  },
  optionEmojiCompact: {
    fontSize: 28,
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2B1D18",
    flexShrink: 1,
    lineHeight: 21,
  },
  optionLabelCompact: {
    fontSize: 16,
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#B9824F",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  selectedBadgeText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    includeFontPadding: false,
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
  setupChecklistCard: {
    backgroundColor: "#FFFDFC",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E7DED6",
    gap: 8,
  },
  setupChecklistRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  setupChecklistTextWrap: {
    flex: 1,
    minWidth: 160,
  },
  setupChecklistTitle: {
    color: "#2B1D18",
    fontSize: 13,
    fontWeight: "900",
  },
  setupChecklistDescription: {
    color: "#7E6F67",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  setupChecklistStatus: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "900",
  },
  setupChecklistStatusReady: {
    backgroundColor: "#F1F7EE",
    color: "#3F5F38",
  },
  setupChecklistStatusWarning: {
    backgroundColor: "#FFF0E8",
    color: "#9B5E3E",
  },
  setupChecklistAction: {
    borderRadius: 999,
    backgroundColor: "#F1E8DD",
    borderWidth: 1,
    borderColor: "#D4C4B8",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  setupChecklistRecheckButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#F1E8DD",
    borderWidth: 1,
    borderColor: "#D4C4B8",
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  setupChecklistActionText: {
    color: "#705642",
    fontSize: 11,
    fontWeight: "900",
  },
  settingsButton: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  resetButton: {
    borderWidth: 1,
    borderColor: "#E7C8B8",
    backgroundColor: "#FFF0E8",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 2,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9B5E3E",
  },
  welcomeHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 20,
  },
  welcomeHeroEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeHeroTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#2B1D18",
    textAlign: "center",
    marginBottom: 8,
  },
  welcomeHeroSubtitle: {
    fontSize: 16,
    color: "#7E6F67",
    textAlign: "center",
    lineHeight: 22,
  },
  welcomeFeaturesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E7DED6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    gap: 14,
  },
  featureEmoji: {
    fontSize: 36,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2B1D18",
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: "#7E6F67",
    lineHeight: 20,
  },
  featureDivider: {
    height: 1,
    backgroundColor: "#E7DED6",
    marginVertical: 16,
  },
  parentHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  parentHeaderTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#2B1D18",
    letterSpacing: 0.5,
  },
  parentHeaderRoom: {
    fontSize: 15,
    color: "#7E6F67",
    fontWeight: "600",
    marginTop: 4,
  },
  parentStatusSection: {
    marginBottom: 24,
  },
  parentStatusLabel: {
    color: "#9B735C",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  parentStatusActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5D8CF",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  parentStatusEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  parentStatusContent: {
    flex: 1,
  },
  parentStatusValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2B1D18",
  },
  parentStatusInactive: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5D8CF",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  parentStatusPlaceholder: {
    color: "#7D6E66",
    fontSize: 16,
    fontWeight: "700",
  },
  parentBuildSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5D8CF",
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginBottom: 14,
  },
  parentSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  parentSectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2B1D18",
  },
  parentSectionBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    backgroundColor: "#88B882",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  parentInputGroup: {
    marginBottom: 22,
  },
  parentInputLabel: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2B1D18",
    marginBottom: 10,
  },
  parentQuestionInput: {
    minHeight: 86,
    borderWidth: 1,
    borderColor: "#E5D8CF",
    borderRadius: 18,
    backgroundColor: "#FFFDFC",
    color: "#2B1D18",
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 18,
    paddingVertical: 14,
    textAlignVertical: "center",
  },
  parentOptionsList: {
    gap: 10,
  },
  parentOptionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FBF9F6",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4D8CC",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  parentOptionIndexText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5B4D47",
    includeFontPadding: false,
    textAlign: "center",
  },
  parentOptionInputStack: {
    flex: 1,
    gap: 8,
  },

  parentOptionInput: {
    fontSize: 15,
    color: "#2B1D18",
    fontWeight: "500",
    paddingVertical: 4,
  },
  parentOptionsHint: {
    color: "#8A7566",
    fontSize: 12,
    lineHeight: 16,
    marginTop: -2,
  },

  parentOptionCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FBF9F6",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D8CC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 62,
  },

  parentOptionCompactInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: "#2B1D18",
    fontWeight: "600",
    paddingVertical: 6,
  },

  parentOptionCompactActions: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  parentMiniImageButton: {
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F1E8DD",
    borderWidth: 1,
    borderColor: "#D4C4B8",
  },

  parentMiniImageButtonReady: {
    backgroundColor: "#F5EBDD",
    borderColor: "#C4A87A",
  },

  parentMiniImageButtonText: {
    color: "#705642",
    fontSize: 12,
    fontWeight: "800",
  },

  parentMiniImageRemoveButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  parentMiniImageRemoveButtonText: {
    color: "#A65B4B",
    fontSize: 11,
    fontWeight: "700",
  },

  parentImageActionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },

  parentImageButton: {
    flex: 1,
    backgroundColor: "#F1E8DD",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D4C4B8",
  },

  parentImageButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#705642",
  },

  parentRemoveImageButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E4D8CC",
  },

  parentRemoveImageButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8A5A44",
  },
  parentRemoveVisualButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignSelf: "center",
  },
  parentRemoveVisualText: {
    color: "#A65B4B",
    fontSize: 12,
    fontWeight: "700",
  },
  parentImageStatusText: {
    fontSize: 12,
    color: "#7E6F67",
  },
  parentPreviewToggle: {
    alignItems: "center",
    paddingVertical: 8,
  },
  parentGenerateVisualsButton: {
    backgroundColor: "#EFE4D8",
    borderWidth: 1,
    borderColor: "#D6C3B4",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    marginTop: 18,
  },
  parentGenerateVisualsButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#6F5D52",
  },
  generateVisualsHint: {
    marginTop: 8,
    color: "#7D6E66",
    fontSize: 13,
    lineHeight: 17,
  },
  parentVisualGenerationStatus: {
    marginTop: 6,
    color: "#8A5A44",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  previewToggleButton: {
    borderWidth: 1,
    borderColor: "#DCCABE",
    backgroundColor: "#FFFDFC",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  previewToggleText: {
    color: "#6F5D52",
    fontSize: 12,
    fontWeight: "800",
  },
  parentPreviewBox: {
    backgroundColor: "#FBF9F6",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4D8CC",
    gap: 12,
    marginTop: 4,
  },
  parentPreviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2B1D18",
  },
  parentPreviewGrid: {
    gap: 10,
  },
  parentActionSection: {
    marginTop: 10,
    gap: 10,
    marginBottom: 24,
  },
  parentSendNotice: {
    backgroundColor: "#F1F7EE",
    borderWidth: 1,
    borderColor: "#CFE3C9",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  parentSendNoticeText: {
    color: "#3F5F38",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  roomCodeActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  roomCodeCopyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F1E5DA",
    borderWidth: 1,
    borderColor: "#E0CBB8",
  },
  roomCodeCopyButtonText: {
    color: "#8A5E3C",
    fontSize: 12,
    fontWeight: "800",
  },
  templateChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  savedTemplateSection: {
    marginTop: 12,
  },

  savedTemplateTitle: {
    color: "#2B1D18",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },

  savedTemplateEmptyText: {
    color: "#8A7566",
    fontSize: 12,
    lineHeight: 16,
  },

  savedTemplateSimpleChip: {
    borderWidth: 1,
    borderColor: "#DCCABE",
    backgroundColor: "#FFFDFC",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 160,
  },

  savedTemplateSimpleChipText: {
    color: "#6F5D52",
    fontSize: 12,
    fontWeight: "800",
  },
  answerOptionsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },

  saveTemplateInlineButton: {
    borderWidth: 1,
    borderColor: "#D6C3B4",
    backgroundColor: "#FFFDFC",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  saveTemplateInlineButtonText: {
    color: "#705642",
    fontSize: 12,
    fontWeight: "900",
  },

  editTemplateNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F5EBDD",
    borderWidth: 1,
    borderColor: "#E1C8B2",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 18,
  },

  editTemplateNoticeTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  editTemplateNoticeLabel: {
    color: "#8A5E3C",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 3,
  },

  editTemplateNoticeName: {
    color: "#2B1D18",
    fontSize: 14,
    fontWeight: "800",
  },

  editTemplateCancelButton: {
    borderRadius: 999,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#DCCABE",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  editTemplateCancelText: {
    color: "#705642",
    fontSize: 12,
    fontWeight: "900",
  },

  templateAddedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F1F7EE",
    borderWidth: 1,
    borderColor: "#CFE3C9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 18,
  },

  templateAddedIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#7FA66F",
    alignItems: "center",
    justifyContent: "center",
  },

  templateAddedIconText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    includeFontPadding: false,
  },

  templateAddedText: {
    flex: 1,
    color: "#3F5F38",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  parentTabRow: {
    flexDirection: "row",
    backgroundColor: "#EFE4D8",
    borderRadius: 18,
    padding: 4,
    marginBottom: 20,
  },

  parentTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 10,
  },

  parentTabButtonActive: {
    backgroundColor: "#FFFFFF",
  },

  parentTabButtonText: {
    color: "#7D6E66",
    fontSize: 14,
    fontWeight: "800",
  },

  parentTabButtonTextActive: {
    color: "#2B1D18",
  },

  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5D8CF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  historyPendingCard: {
    backgroundColor: "#FFF8F1",
    borderColor: "#E7CDB4",
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  historyStatusText: {
    color: "#8A5E3C",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  historyLabel: {
    color: "#A8978B",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 3,
    textTransform: "uppercase",
  },

  historyAnswer: {
    color: "#2B1D18",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  historyReuseButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#EFE4D8",
    borderWidth: 1,
    borderColor: "#D6C3B4",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  historyReuseButtonText: {
    color: "#705642",
    fontSize: 12,
    fontWeight: "900",
  },
  historyPendingAnswer: {
    color: "#8A5E3C",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },

  historyQuestion: {
    color: "#6F5D52",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },

  historyTime: {
    color: "#A8978B",
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 0,
  },

  historyEmptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5D8CF",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },

  historyEmptyText: {
    color: "#7D6E66",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  templateCardList: {
    gap: 10,
  },

  templateManageCard: {
    gap: 12,
    backgroundColor: "#FFFDFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5D8CF",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  templateManageContent: {
    flex: 1,
    minWidth: 0,
  },

  templateManageTitle: {
    color: "#2B1D18",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 3,
  },

  templateManageQuestion: {
    color: "#6F5D52",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
    marginBottom: 7,
  },

  templateManageMeta: {
    color: "#A8978B",
    fontSize: 12,
    fontWeight: "700",
  },

  templateManageActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  templateUseButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#EFE4D8",
    borderWidth: 1,
    borderColor: "#D6C3B4",
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  templateEditButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#DCCABE",
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  templateEditButtonText: {
    color: "#705642",
    fontSize: 12,
    fontWeight: "900",
  },

  templateUseButtonText: {
    color: "#705642",
    fontSize: 12,
    fontWeight: "900",
  },

  templateDeleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  templateDeleteButtonText: {
    color: "#A65B4B",
    fontSize: 12,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(43, 29, 24, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  saveTemplateModalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5D8CF",
    paddingHorizontal: 20,
    paddingVertical: 22,
  },

  saveTemplateModalTitle: {
    color: "#2B1D18",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },

  saveTemplateModalSubtitle: {
    color: "#7D6E66",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    marginBottom: 16,
  },

  saveTemplateModalInput: {
    borderWidth: 1,
    borderColor: "#E5D8CF",
    borderRadius: 16,
    backgroundColor: "#FFFDFC",
    color: "#2B1D18",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 18,
  },

  saveTemplateModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },

  saveTemplateModalCancelButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F5EEE8",
  },

  saveTemplateModalCancelText: {
    color: "#7D6E66",
    fontSize: 14,
    fontWeight: "800",
  },

  saveTemplateModalSaveButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#B9824F",
  },

  saveTemplateModalSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  savedTemplateMiniHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  savedTemplateViewAllText: {
    color: "#8A5E3C",
    fontSize: 12,
    fontWeight: "900",
  },
});

export default null;

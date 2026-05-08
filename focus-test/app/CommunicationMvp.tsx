import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  SafeAreaView,
  ScrollView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type AppMode = "select" | "parent" | "child";
type ChildStage = "idle" | "incoming" | "choice" | "confirmation";

interface SessionOption {
  id: string;
  label: string;
  emoji: string;
}

interface SentSession {
  id: string;
  question: string;
  options: SessionOption[];
  createdAt: number;
}

const DEFAULT_QUESTION = "What would you like to eat?";
const DEFAULT_OPTIONS = ["Rice", "Noodles", "Pizza", "Sandwich"];
const FALLBACK_EMOJIS = ["🌿", "☁️", "✨", "🫧"];

function getEmojiForLabel(label: string, index: number) {
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

function buildSessionOptions(optionLabels: string[]): SessionOption[] {
  return optionLabels.map((label, index) => {
    const cleanedLabel = label.trim() || `Option ${index + 1}`;

    return {
      id: String(index + 1),
      label: cleanedLabel,
      emoji: getEmojiForLabel(cleanedLabel, index),
    };
  });
}

function createSession(question: string, optionLabels: string[]): SentSession {
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

function OptionCard({
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

function Header({ title, subtitle, onBack }: HeaderProps) {
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

interface ParentModeScreenProps {
  question: string;
  optionLabels: string[];
  sentSession: SentSession | null;
  childAnswer: SessionOption | null;
  showPreview: boolean;
  onQuestionChange: (value: string) => void;
  onOptionLabelChange: (index: number, value: string) => void;
  onPreviewToggle: () => void;
  onSendToChild: () => void;
  onBackToSelect: () => void;
}

function ParentModeScreen({
  question,
  optionLabels,
  sentSession,
  childAnswer,
  showPreview,
  onQuestionChange,
  onOptionLabelChange,
  onPreviewToggle,
  onSendToChild,
  onBackToSelect,
}: ParentModeScreenProps) {
  const currentSession = sentSession ?? createSession(question, optionLabels);
  const parentStatusTitle = !sentSession
    ? "No session sent yet"
    : childAnswer
      ? `Child chose: ${childAnswer.label}`
      : "Waiting for child response";
  const scrollRef = useRef<ScrollView | null>(null);
  const [optionRowPositions, setOptionRowPositions] = useState<number[]>([]);

  const scrollFieldIntoView = (index: number) => {
    const rowY = optionRowPositions[index];

    if (rowY === undefined || !scrollRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, rowY - 100),
        animated: true,
      });
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={8}
      style={styles.flexFill}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, styles.parentScrollContent]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Parent Mode"
          subtitle="Build a gentle session"
          onBack={onBackToSelect}
        />

      <View style={styles.statusCard}>
        <Text style={styles.sectionLabel}>Session status</Text>
        <Text style={styles.statusTitle}>{parentStatusTitle}</Text>
        <Text style={styles.statusBody}>
          {sentSession
            ? sentSession.question
            : "Create a question and send it when you are ready."}
        </Text>
        {childAnswer ? (
          <View style={styles.answerBadge}>
            <Text style={styles.answerBadgeEmoji}>{childAnswer.emoji}</Text>
            <Text style={styles.answerBadgeText}>{childAnswer.label}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.panelCard}>
        <Text style={styles.sectionLabel}>Question</Text>
        <TextInput
          accessibilityLabel="Question text"
          cursorColor="#A97E57"
          placeholder="What would you like to ask?"
          placeholderTextColor="#AA9C94"
          selectionColor="#D8B48F"
          style={styles.textInput}
          value={question}
          onChangeText={onQuestionChange}
          multiline
        />

        <Text style={[styles.sectionLabel, styles.optionsLabel]}>Options</Text>
        <View style={styles.parentOptionsList}>
          {optionLabels.map((label, index) => (
            <View
              key={`draft-${index}`}
              onLayout={(event) => {
                const rowY = event.nativeEvent.layout.y;
                setOptionRowPositions((currentPositions) => {
                  const nextPositions = [...currentPositions];
                  nextPositions[index] = rowY;
                  return nextPositions;
                });
              }}
              style={styles.parentOptionRow}
            >
              <Text style={styles.parentOptionNumber}>{index + 1}</Text>
              <TextInput
                accessibilityLabel={`Option ${index + 1} label`}
                cursorColor="#A97E57"
                placeholder={`Option ${index + 1}`}
                placeholderTextColor="#AA9C94"
                selectionColor="#D8B48F"
                style={styles.optionInput}
                value={label}
                onChangeText={(value) => onOptionLabelChange(index, value)}
                onFocus={() => scrollFieldIntoView(index)}
              />
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onPreviewToggle}
          >
            <Text style={styles.secondaryButtonText}>
              {showPreview ? "Hide preview" : "Preview Child Session"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={onSendToChild}>
            <Text style={styles.primaryButtonText}>Send to Child</Text>
          </TouchableOpacity>
        </View>
        </View>

        {showPreview ? (
          <View style={styles.previewCard}>
            <Text style={styles.sectionLabel}>Child preview</Text>
            <Text style={styles.previewQuestion}>{currentSession.question}</Text>
            <View style={styles.previewGrid}>
              {currentSession.options.map((option) => (
                <OptionCard key={option.id} option={option} compact disabled />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface ChildModeScreenProps {
  session: SentSession | null;
  stage: ChildStage;
  selectedOptionId: string | null;
  onStart: () => void;
  onSelectOption: (option: SessionOption) => void;
  onSendAnswer: () => void;
  onDone: () => void;
  onBackToSelect: () => void;
}

function ChildModeScreen({
  session,
  stage,
  selectedOptionId,
  onStart,
  onSelectOption,
  onSendAnswer,
  onDone,
  onBackToSelect,
}: ChildModeScreenProps) {
  const selectedOption =
    session?.options.find((option) => option.id === selectedOptionId) ?? null;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Header
        title="Child Mode"
        subtitle="Simple and calm"
        onBack={onBackToSelect}
      />

      {!session || stage === "idle" ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>☁️</Text>
          <Text style={styles.heroTitle}>No message right now</Text>
          <Text style={styles.heroSubtitle}>
            You can stay here until a new message arrives.
          </Text>
        </View>
      ) : null}

      {session && stage === "incoming" ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>📩</Text>
          <Text style={styles.heroTitle}>Mum wants to ask you something</Text>
          <Text style={styles.heroSubtitle}>You can answer when ready</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
            <Text style={styles.primaryButtonText}>Start</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "choice" ? (
        <View style={styles.choiceCard}>
          <Text style={styles.questionTitle}>{session.question}</Text>

          <View style={styles.choiceList}>
            {session.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={option.id === selectedOptionId}
                onPress={onSelectOption}
              />
            ))}
          </View>

          <TouchableOpacity
            disabled={!selectedOption}
            style={[
              styles.primaryButton,
              !selectedOption && styles.primaryButtonDisabled,
            ]}
            onPress={onSendAnswer}
          >
            <Text style={styles.primaryButtonText}>Send Answer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "confirmation" && selectedOption ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>✓</Text>
          <Text style={styles.heroTitle}>Sent to Mum</Text>
          <Text style={styles.heroSubtitle}>You chose {selectedOption.label}</Text>
          <Text style={styles.confirmationEmoji}>{selectedOption.emoji}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

interface ModeSelectScreenProps {
  onParentMode: () => void;
  onChildMode: () => void;
}

function ModeSelectScreen({ onParentMode, onChildMode }: ModeSelectScreenProps) {
  return (
    <View style={styles.modeSelectContainer}>
      <View style={styles.modeHeroCard}>
        <Text style={styles.modeHeroEmoji}>☁️</Text>
        <Text style={styles.modeHeroTitle}>Communication MVP</Text>
        <Text style={styles.modeHeroSubtitle}>
          Choose how you want to test the flow.
        </Text>
      </View>

      <TouchableOpacity style={styles.modeButton} onPress={onParentMode}>
        <Text style={styles.modeButtonEmoji}>🧑‍🧒</Text>
        <Text style={styles.modeButtonTitle}>Parent Mode</Text>
        <Text style={styles.modeButtonSubtitle}>
          Create a calm structured session
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.modeButton} onPress={onChildMode}>
        <Text style={styles.modeButtonEmoji}>👦</Text>
        <Text style={styles.modeButtonTitle}>Child Mode</Text>
        <Text style={styles.modeButtonSubtitle}>
          Answer with simple visual choices
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CommunicationMvpApp() {
  const [mode, setMode] = useState<AppMode>("select");
  const [draftQuestion, setDraftQuestion] = useState(DEFAULT_QUESTION);
  const [draftOptions, setDraftOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [showPreview, setShowPreview] = useState(false);
  const [sentSession, setSentSession] = useState<SentSession | null>(null);
  const [childStage, setChildStage] = useState<ChildStage>("idle");
  const [childSelectedOptionId, setChildSelectedOptionId] = useState<string | null>(null);
  const [childAnswer, setChildAnswer] = useState<SessionOption | null>(null);

  const handleQuestionChange = (value: string) => {
    setDraftQuestion(value);
  };

  const handleOptionLabelChange = (index: number, value: string) => {
    setDraftOptions((currentOptions) => {
      const nextOptions = [...currentOptions];
      nextOptions[index] = value;
      return nextOptions;
    });
  };

  const handlePreviewToggle = () => {
    setShowPreview((currentValue) => !currentValue);
  };

  const handleSendToChild = () => {
    const nextSession = createSession(draftQuestion, draftOptions);

    setSentSession(nextSession);
    setChildStage("incoming");
    setChildSelectedOptionId(null);
    setChildAnswer(null);
    setShowPreview(false);
    setMode("parent");
  };

  const handleStartChildSession = () => {
    setChildStage("choice");
  };

  const handleSelectChildOption = (option: SessionOption) => {
    setChildSelectedOptionId(option.id);
  };

  const handleSendChildAnswer = () => {
    if (!sentSession) {
      return;
    }

    const selected = sentSession.options.find(
      (option) => option.id === childSelectedOptionId
    );

    if (!selected) {
      return;
    }

    setChildAnswer(selected);
    setChildStage("confirmation");
  };

  const handleDoneChildFlow = () => {
    setChildStage("idle");
    setChildSelectedOptionId(null);
  };

  const handleBackToSelect = () => {
    setMode("select");
  };

  const renderCurrentMode = () => {
    if (mode === "parent") {
      return (
        <ParentModeScreen
          question={draftQuestion}
          optionLabels={draftOptions}
          sentSession={sentSession}
          childAnswer={childAnswer}
          showPreview={showPreview}
          onQuestionChange={handleQuestionChange}
          onOptionLabelChange={handleOptionLabelChange}
          onPreviewToggle={handlePreviewToggle}
          onSendToChild={handleSendToChild}
          onBackToSelect={handleBackToSelect}
        />
      );
    }

    if (mode === "child") {
      return (
        <ChildModeScreen
          session={sentSession}
          stage={childStage}
          selectedOptionId={childSelectedOptionId}
          onStart={handleStartChildSession}
          onSelectOption={handleSelectChildOption}
          onSendAnswer={handleSendChildAnswer}
          onDone={handleDoneChildFlow}
          onBackToSelect={handleBackToSelect}
        />
      );
    }

    return (
      <View style={styles.selectScreenWrapper}>
        <ModeSelectScreen
          onParentMode={() => setMode("parent")}
          onChildMode={() => setMode("child")}
        />
      </View>
    );
  };

  return <SafeAreaView style={styles.appShell}>{renderCurrentMode()}</SafeAreaView>;
}

const styles = StyleSheet.create({
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
    paddingTop: 14,
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
});

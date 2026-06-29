import React from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import type { CommunicationSession, SpeechWordFeedback } from "./communicationHelpers";
import {
  getSpeechPracticePhrase,
  splitSpeechWords,
  subscribeToSession,
  submitAnswer,
} from "./communicationHelpers";
import { OptionCard } from "./communicationUI";
import { styles } from "./communicationCommon";

interface ChildModeScreenProps {
  roomId: string;
  onResetSetup: () => void;
}

type SpeechFeedbackCard = {
  tone: "good" | "try";
  mainText: string;
  secondaryText: string;
};

/**
 * ChildModeScreen - Simulates the child's experience
 * Listens for incoming sessions and updates UI based on session status
 * Provides simple visual choices for the child to select and submit
 * 
 * Handles multiple stages: idle (no session), incoming (new session), choice (selecting an option), confirmation (answer sent)
 * Uses subscribeToSession to listen for session updates and submitAnswer to send the selected option back to the parent
 * Designed to be simple and calm, with clear prompts and feedback for the child user
 */
export default function ChildModeScreen({ roomId, onResetSetup }: ChildModeScreenProps) {
  // This screen mirrors the room document, steps through the child flow, and triggers the focus alert when a new session arrives.
  const [session, setSession] = React.useState<CommunicationSession | null>(null);
  const [stage, setStage] = React.useState<"idle" | "incoming" | "choice" | "confirmation">("idle");
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null);
  const [selectionSource, setSelectionSource] = React.useState<"tap" | "speech" | "typedPractice" | null>(null);
  const [mockTranscript, setMockTranscript] = React.useState("");
  const [isListening, setIsListening] = React.useState(false);
  const [isAutoListenEnabled, setIsAutoListenEnabled] = React.useState(false);
  const [liveTranscript, setLiveTranscript] = React.useState("");
  const [speechFeedbackTranscript, setSpeechFeedbackTranscript] = React.useState("");
  const [speechError, setSpeechError] = React.useState<string | null>(null);
  const [speechMessage, setSpeechMessage] = React.useState("Tap an answer, then practise saying it.");
  const [speechFeedbackCard, setSpeechFeedbackCard] =
    React.useState<SpeechFeedbackCard | null>(null);
  const [completedPracticeWordCount, setCompletedPracticeWordCount] = React.useState(0);
  const [isTesterModeEnabled, setIsTesterModeEnabled] = React.useState(false);
  const [practicePhraseTapCount, setPracticePhraseTapCount] = React.useState(0);
  const previousSessionIdRef = React.useRef<string | null>(null);
  const autoListenEnabledRef = React.useRef(false);
  const restartListeningTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedPracticeWordCountRef = React.useRef(0);
  const selectedOptionIdRef = React.useRef<string | null>(null);
  const stageRef = React.useRef(stage);
  const clearRestartListeningTimer = React.useCallback(() => {
    if (restartListeningTimerRef.current) {
      clearTimeout(restartListeningTimerRef.current);
      restartListeningTimerRef.current = null;
    }
  }, []);
  const abortSpeechRecognition = React.useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Speech recognition can already be stopped when session state changes.
    }
  }, []);

  const resetSpeechPracticeState = React.useCallback(() => {
    setSelectedOptionId(null);
    setSelectionSource(null);
    setMockTranscript("");
    setLiveTranscript("");
    setSpeechFeedbackTranscript("");
    setSpeechError(null);
    setSpeechMessage("Tap an answer, then practise saying it.");
    setSpeechFeedbackCard(null);
    setCompletedPracticeWordCount(0);
    setPracticePhraseTapCount(0);
    setIsAutoListenEnabled(false);
    completedPracticeWordCountRef.current = 0;
    selectedOptionIdRef.current = null;
  }, []);
  React.useEffect(() => {
    selectedOptionIdRef.current = selectedOptionId;
  }, [selectedOptionId]);

  React.useEffect(() => {
    completedPracticeWordCountRef.current = completedPracticeWordCount;
  }, [completedPracticeWordCount]);

  React.useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
// Subscribe to session updates for the given roomId and update local state accordingly
 React.useEffect(() => {
  const unsub = subscribeToSession((s) => {
    setSession(s);
// Update the child stage based on the current room status.
// Handle session status changes to update the UI stage and trigger alerts
    if (!s || s.status === "idle") {
      setStage("idle");
      previousSessionIdRef.current = s?.id ?? null;
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      abortSpeechRecognition();
      setIsListening(false);
      resetSpeechPracticeState();
      return;
    }

    if (s.status === "sent") {
      if (s.id !== previousSessionIdRef.current) {
        autoListenEnabledRef.current = false;
        setIsAutoListenEnabled(false);
        clearRestartListeningTimer();
        abortSpeechRecognition();
        setIsListening(false);
        resetSpeechPracticeState();
      }

      previousSessionIdRef.current = s.id;
      setStage("incoming");
      return;
    }

    if (s.status === "answered") {
      previousSessionIdRef.current = s.id;
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      setStage("confirmation");
    }
  }, roomId);

  return () => unsub();
}, [abortSpeechRecognition, clearRestartListeningTimer, resetSpeechPracticeState, roomId]);

  React.useEffect(() => {
    if (stage !== "choice" && isListening) {
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      abortSpeechRecognition();
      setIsListening(false);
    }
  }, [abortSpeechRecognition, clearRestartListeningTimer, isListening, stage]);

  const selectedOption = session?.options.find((o) => o.id === selectedOptionId) ?? null;
  const speechPracticePhrase = selectedOption
    ? getSpeechPracticePhrase(selectedOption.label, session?.speechTemplate ?? undefined)
    : "";
  const speechPracticeWords = React.useMemo(
    () => splitSpeechWords(speechPracticePhrase),
    [speechPracticePhrase],
  );
  const startRecognitionSession = React.useCallback(() => {
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      maxAlternatives: 1,
      contextualStrings: speechPracticePhrase ? [speechPracticePhrase] : [],
    });
    setIsListening(true);
  }, [speechPracticePhrase]);
  const scheduleListeningRestart = React.useCallback(() => {
    clearRestartListeningTimer();

    if (
      !autoListenEnabledRef.current ||
      stageRef.current !== "choice" ||
      !selectedOptionIdRef.current ||
      completedPracticeWordCountRef.current >= speechPracticeWords.length
    ) {
      return;
    }

    setSpeechError(null);
    const nextWord = speechPracticeWords[completedPracticeWordCountRef.current] ?? "";
    setSpeechMessage(
      nextWord
        ? `Still listening... say: ${nextWord}`
        : "Listening... take your time",
    );

    restartListeningTimerRef.current = setTimeout(() => {
      restartListeningTimerRef.current = null;

      if (
        !autoListenEnabledRef.current ||
        stageRef.current !== "choice" ||
        !selectedOptionIdRef.current ||
        completedPracticeWordCountRef.current >= speechPracticeWords.length
      ) {
        return;
      }

      try {
        startRecognitionSession();
      } catch {
        setIsListening(false);
        autoListenEnabledRef.current = false;
        setIsAutoListenEnabled(false);
        setSpeechError(null);
        setSpeechMessage("Start speaking when ready.");
      }
    }, 600);
  }, [
    clearRestartListeningTimer,
    speechPracticeWords,
    startRecognitionSession,
  ]);
  const applyTranscriptMatch = React.useCallback((value: string, source: "speech" | "typedPractice") => {
    if (!session || !selectedOptionId) {
      setSpeechMessage("Choose an answer to practise first.");
      return;
    }

    const selectedPracticeOption = session.options.find(
      (option) => option.id === selectedOptionId,
    );

    if (!selectedPracticeOption) {
      setSpeechMessage("Choose an answer to practise first.");
      return;
    }

    const practicePhrase = getSpeechPracticePhrase(
      selectedPracticeOption.label,
      session.speechTemplate ?? undefined,
    );
    const targetWords = splitSpeechWords(practicePhrase);
    const transcriptWords = splitSpeechWords(value);

    if (targetWords.length === 0 || transcriptWords.length === 0) {
      return;
    }

    let nextTargetIndex = completedPracticeWordCount;
    let transcriptIndex = 0;

    while (
      transcriptIndex < nextTargetIndex &&
      transcriptWords[transcriptIndex] === targetWords[transcriptIndex]
    ) {
      transcriptIndex += 1;
    }

    for (
      let wordIndex = transcriptIndex;
      wordIndex < transcriptWords.length && nextTargetIndex < targetWords.length;
      wordIndex += 1
    ) {
      const nextTargetWord = targetWords[nextTargetIndex];
      const heardWord = transcriptWords[wordIndex];

      if (heardWord !== nextTargetWord) {
        setCompletedPracticeWordCount(nextTargetIndex);
        completedPracticeWordCountRef.current = nextTargetIndex;
        setSpeechMessage(`Try again: ${nextTargetWord}`);
        setSpeechFeedbackCard({
          tone: "try",
          mainText: "Try again",
          secondaryText: `Say: ${nextTargetWord}`,
        });
        return;
      }

      nextTargetIndex += 1;
    }

    setCompletedPracticeWordCount(nextTargetIndex);
    completedPracticeWordCountRef.current = nextTargetIndex;

    if (nextTargetIndex >= targetWords.length) {
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      abortSpeechRecognition();
      setIsListening(false);
      setSelectionSource(selectionSource === "tap" ? "tap" : source);
      setSpeechMessage("Good. Ready to send.");
      setSpeechFeedbackCard({
        tone: "good",
        mainText: "Good",
        secondaryText: "Ready to send",
      });
      return;
    }

    setSpeechMessage(`Good. Now say: ${targetWords[nextTargetIndex]}`);
    setSpeechFeedbackCard({
      tone: "good",
      mainText: "Good",
      secondaryText: `Now say: ${targetWords[nextTargetIndex]}`,
    });
  }, [abortSpeechRecognition, clearRestartListeningTimer, completedPracticeWordCount, selectedOptionId, selectionSource, session]);

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript?.trim();

    if (!transcript) {
      return;
    }

    setLiveTranscript(transcript);
    setSpeechFeedbackTranscript(transcript);
    setSpeechError(null);
    applyTranscriptMatch(transcript, "speech");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    scheduleListeningRestart();
  });

  useSpeechRecognitionEvent("error", () => {
    setIsListening(false);
    if (autoListenEnabledRef.current) {
      scheduleListeningRestart();
      return;
    }

    setSpeechError(null);
    setSpeechMessage("Start speaking when ready.");
  });

  React.useEffect(() => {
    return () => {
      autoListenEnabledRef.current = false;
      clearRestartListeningTimer();
      ExpoSpeechRecognitionModule.abort();
    };
  }, [clearRestartListeningTimer]);

  const startListening = async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted || !ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        autoListenEnabledRef.current = false;
        setIsAutoListenEnabled(false);
        setSpeechError(null);
        setSpeechMessage("Start speaking when ready.");
        return;
      }

      setLiveTranscript("");
      setSpeechFeedbackTranscript("");
      setSpeechError(null);
      setSpeechFeedbackCard(null);
      if (!selectedOptionId) {
        autoListenEnabledRef.current = false;
        setIsAutoListenEnabled(false);
        setSpeechMessage("Choose an answer to practise first.");
        return;
      }

      autoListenEnabledRef.current = true;
      setIsAutoListenEnabled(true);
      clearRestartListeningTimer();
      setSpeechMessage("Listening... take your time");
      startRecognitionSession();
    } catch {
      setIsListening(false);
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      setSpeechError(null);
      setSpeechMessage("Start speaking when ready.");
    }
  };

  const stopListening = async () => {
    try {
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setSpeechError(null);
      setSpeechMessage("Start speaking when ready.");
    } finally {
      setIsListening(false);
    }
  };

  const handleMockTranscriptChange = (value: string) => {
    setMockTranscript(value);
    setSpeechFeedbackTranscript(value);
    setSpeechError(null);
    applyTranscriptMatch(value, "typedPractice");
  };

  const handlePracticePhrasePress = () => {
    if (isTesterModeEnabled) {
      return;
    }

    setPracticePhraseTapCount((currentCount) => {
      const nextCount = currentCount + 1;

      if (nextCount >= 5) {
        setIsTesterModeEnabled(true);
      }

      return nextCount;
    });
  };

  const liveSpeechFeedbackMessage = speechFeedbackTranscript.trim()
    ? speechMessage
    : selectedOption
      ? "Start speaking when ready."
      : "Tap an answer, then press Start Speaking.";
  const isSpeechListeningActive = isListening || isAutoListenEnabled;
  const speechFeedbackWords = React.useMemo<SpeechWordFeedback[]>(() => {
    return speechPracticeWords.map((word, index) => ({
      targetWord: word,
      status:
        index < completedPracticeWordCount
          ? "matched" as const
          : index === completedPracticeWordCount
            ? "current" as const
            : "pending" as const,
    }));
  }, [completedPracticeWordCount, speechPracticeWords]);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.settingsButton}>
        <TouchableOpacity style={styles.resetButton} onPress={onResetSetup}>
          <Text style={styles.resetButtonText}>Reset Device Setup</Text>
        </TouchableOpacity>
      </View>

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
          <Text style={styles.heroTitle}>New message</Text>
          <Text style={styles.heroSubtitle}>You can answer when ready</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStage("choice")}>
            <Text style={styles.primaryButtonText}>Start</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "choice" ? (
        <View style={styles.choiceCard}>
          <Text style={styles.questionTitle}>{session.title}</Text>
          <Text style={styles.choiceInstructionText}>
            Tap an answer first.
          </Text>

          <View style={styles.choiceList}>
            <View style={styles.speechPracticeCard}>
              <Text style={styles.speechPracticeTitle}>Try saying your answer</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handlePracticePhrasePress}
              >
                <Text style={styles.speechPracticeHint}>
                  {selectedOption
                    ? `Say this: ${speechPracticePhrase}`
                  : "Tap a card first. You can still send by tapping only."}
                </Text>
              </TouchableOpacity>
              {selectedOption && speechFeedbackCard ? (
                <View
                  style={[
                    styles.speechFeedbackCard,
                    speechFeedbackCard.tone === "good" &&
                      styles.speechFeedbackCardGood,
                    speechFeedbackCard.tone === "try" &&
                      styles.speechFeedbackCardTry,
                  ]}
                >
                  <Text style={styles.speechFeedbackCardMain}>
                    {speechFeedbackCard.mainText}
                  </Text>
                  <Text style={styles.speechFeedbackCardSecondary}>
                    {speechFeedbackCard.secondaryText}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.speechListenButton,
                  isSpeechListeningActive && styles.speechListenButtonActive,
                ]}
                onPress={isSpeechListeningActive ? stopListening : startListening}
              >
                <Text style={styles.speechListenButtonText}>
                  {isSpeechListeningActive ? "Stop listening" : "Start speaking"}
                </Text>
              </TouchableOpacity>
              {liveTranscript ? (
                <Text style={styles.speechLiveTranscript}>
                  Live: {liveTranscript}
                </Text>
              ) : null}
              <View style={styles.liveSpeechFeedbackBox}>
                {speechFeedbackWords.length > 0 ? (
                  <View style={styles.liveSpeechWordRow}>
                    {speechFeedbackWords.map((word, index) => (
                      <View
                        key={`${word.targetWord}-${index}`}
                        style={[
                          styles.liveSpeechWordChip,
                          word.status === "matched" && styles.liveSpeechWordMatched,
                          word.status === "mismatch" && styles.liveSpeechWordMismatch,
                          word.status === "current" && styles.liveSpeechWordCurrent,
                        ]}
                      >
                        <Text
                          style={[
                            styles.liveSpeechWordText,
                            word.status === "matched" && styles.liveSpeechWordTextMatched,
                            word.status === "mismatch" && styles.liveSpeechWordTextMismatch,
                            word.status === "current" && styles.liveSpeechWordTextCurrent,
                          ]}
                        >
                          {word.status === "matched" ? "✓ " : ""}
                          {word.targetWord}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.liveSpeechFeedbackText}>
                  {liveSpeechFeedbackMessage}
                </Text>
              </View>
              {isTesterModeEnabled ? (
                <>
                  <Text style={styles.speechFallbackLabel}>
                    Tester transcript
                  </Text>
                  <Text style={styles.liveSpeechFeedbackText}>
                    For testing speech logic only.
                  </Text>
                  <TextInput
                    value={mockTranscript}
                    onChangeText={handleMockTranscriptChange}
                    placeholder="Type the phrase to test"
                    placeholderTextColor="#A8978B"
                    style={styles.speechTranscriptInput}
                  />
                </>
              ) : null}
              <Text style={styles.speechPracticeMessage}>{speechMessage}</Text>
            </View>

            {session.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                compact
                selected={option.id === selectedOptionId}
                onPress={() => {
                  autoListenEnabledRef.current = false;
                  setIsAutoListenEnabled(false);
                  clearRestartListeningTimer();
                  abortSpeechRecognition();
                  setIsListening(false);
                  selectedOptionIdRef.current = option.id;
                  completedPracticeWordCountRef.current = 0;
                  setSelectedOptionId(option.id);
                  setSelectionSource("tap");
                  setMockTranscript("");
                  setLiveTranscript("");
                  setSpeechFeedbackTranscript("");
                  setSpeechError(null);
                  setCompletedPracticeWordCount(0);
                  setSpeechFeedbackCard(null);
                  setSpeechMessage("Say this phrase when ready.");
                }}
              />
            ))}
          </View>

          <View
            style={[
              styles.selectedAnswerPanel,
              !selectedOption && styles.selectedAnswerPanelEmpty,
            ]}
          >
            <Text style={styles.selectedAnswerLabel}>Selected answer</Text>
            <Text style={styles.selectedAnswerText}>
              {selectedOption
                ? `Selected: ${selectedOption.label}`
                : "Say or tap an answer first"}
            </Text>
          </View>

          <TouchableOpacity
            disabled={!selectedOption}
            style={[
              styles.primaryButton,
              !selectedOption && styles.primaryButtonDisabled,
            ]}
            onPress={async () => {
              if (!selectedOption) return;
              try {
                await submitAnswer(selectedOption.id, roomId);
              } catch (e) {
                console.warn("submitAnswer failed", e);
                Alert.alert("Could not send", "Please try again.");
              }
            }}
          >
            <Text style={styles.primaryButtonText}>Send Answer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "confirmation" && (session.selectedAnswer || selectedOption) ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>✓</Text>
          <Text style={styles.heroTitle}>Sent to Mum</Text>
          <Text style={styles.heroSubtitle}>
            You chose {session?.options.find((o) => o.id === session.selectedAnswer)?.label ?? selectedOption?.label}
          </Text>
          <Text style={styles.confirmationEmoji}>{session?.options.find((o) => o.id === session.selectedAnswer)?.emoji ?? selectedOption?.emoji}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => setStage("idle")}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

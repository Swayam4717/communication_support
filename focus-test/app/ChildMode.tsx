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
import type { CommunicationSession } from "./communicationHelpers";
import {
  compareTranscriptToOption,
  getSpeechPracticePhrase,
  splitSpeechWords,
  subscribeToSession,
  submitAnswer,
} from "./communicationHelpers";
import { Header, OptionCard } from "./communicationUI";
import { styles } from "./communicationCommon";

interface ChildModeScreenProps {
  roomId: string;
  onResetSetup: () => void;
}

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
  const [liveTranscript, setLiveTranscript] = React.useState("");
  const [speechFeedbackTranscript, setSpeechFeedbackTranscript] = React.useState("");
  const [speechError, setSpeechError] = React.useState<string | null>(null);
  const [speechMessage, setSpeechMessage] = React.useState("Tap an answer, then practise saying it.");
  const [retryWordIndex, setRetryWordIndex] = React.useState<number | null>(null);
  const [correctedRetryWordIndexes, setCorrectedRetryWordIndexes] = React.useState<number[]>([]);
  const previousSessionIdRef = React.useRef<string | null>(null);
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
    setRetryWordIndex(null);
    setCorrectedRetryWordIndexes([]);
  }, []);
// Subscribe to session updates for the given roomId and update local state accordingly
 React.useEffect(() => {
  const unsub = subscribeToSession((s) => {
    setSession(s);
// Update the child stage based on the current room status.
// Handle session status changes to update the UI stage and trigger alerts
    if (!s || s.status === "idle") {
      setStage("idle");
      previousSessionIdRef.current = s?.id ?? null;
      abortSpeechRecognition();
      setIsListening(false);
      resetSpeechPracticeState();
      return;
    }

    if (s.status === "sent") {
      if (s.id !== previousSessionIdRef.current) {
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
      setStage("confirmation");
    }
  }, roomId);

  return () => unsub();
}, [abortSpeechRecognition, resetSpeechPracticeState, roomId]);

  React.useEffect(() => {
    if (stage !== "choice" && isListening) {
      abortSpeechRecognition();
      setIsListening(false);
    }
  }, [abortSpeechRecognition, isListening, stage]);

  const selectedOption = session?.options.find((o) => o.id === selectedOptionId) ?? null;
  const speechPracticePhrase = selectedOption
    ? getSpeechPracticePhrase(selectedOption.label)
    : "";
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

    const practicePhrase = getSpeechPracticePhrase(selectedPracticeOption.label);
    const speechMatch = compareTranscriptToOption(value, practicePhrase);

    if (retryWordIndex !== null) {
      const retryTargetWord = speechMatch.targetWords[retryWordIndex];
      const transcriptWords = splitSpeechWords(value);
      const retryAccepted = retryTargetWord
        ? transcriptWords.includes(retryTargetWord)
        : false;

      if (!retryTargetWord) {
        setRetryWordIndex(null);
        setSpeechMessage("Keep going.");
        return;
      }

      if (retryAccepted) {
        setRetryWordIndex(null);
        setCorrectedRetryWordIndexes((previousIndexes) =>
          previousIndexes.includes(retryWordIndex)
            ? previousIndexes
            : [...previousIndexes, retryWordIndex],
        );
        setSpeechFeedbackTranscript(practicePhrase);
        setSelectionSource(selectionSource === "tap" ? "tap" : source);
        setSpeechMessage("Good. Ready to send.");
        return;
      }

      setSpeechMessage(`Try saying: ${retryTargetWord}`);
      return;
    }

    if (speechMatch.isExactMatch || speechMatch.mismatchCount === 0) {
      setRetryWordIndex(null);
      setCorrectedRetryWordIndexes([]);
      setSelectionSource(selectionSource === "tap" ? "tap" : source);
      setSpeechMessage("Ready to send.");
      return;
    }

    const retryFeedbackIndex = speechMatch.wordFeedback.findIndex(
      (word) => word.status === "mismatch" || word.status === "current",
    );
    const retryWord =
      retryFeedbackIndex >= 0
        ? speechMatch.wordFeedback[retryFeedbackIndex].targetWord
        : null;

    setRetryWordIndex(retryFeedbackIndex >= 0 ? retryFeedbackIndex : null);
    setCorrectedRetryWordIndexes([]);
    setSpeechMessage(retryWord ? `Try saying: ${retryWord}` : "Keep going.");
  }, [retryWordIndex, selectedOptionId, selectionSource, session]);

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
  });

  useSpeechRecognitionEvent("error", () => {
    setIsListening(false);
    setSpeechError("Microphone is off. You can still tap an answer.");
    setSpeechMessage("Microphone is off. You can still tap an answer.");
  });

  React.useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  const startListening = async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted || !ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setSpeechError("Microphone is off. You can still tap an answer.");
        setSpeechMessage("Microphone is off. You can still tap an answer.");
        return;
      }

      setLiveTranscript("");
      setSpeechFeedbackTranscript("");
      setSpeechError(null);
      if (!selectedOptionId) {
        setSpeechMessage("Choose an answer to practise first.");
        return;
      }

      setSpeechMessage("Listening...");
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
        contextualStrings: speechPracticePhrase ? [speechPracticePhrase] : [],
      });
      setIsListening(true);
    } catch {
      setIsListening(false);
      setSpeechError("Microphone is off. You can still tap an answer.");
      setSpeechMessage("Microphone is off. You can still tap an answer.");
    }
  };

  const stopListening = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setSpeechError("Microphone is off. You can still tap an answer.");
      setSpeechMessage("Microphone is off. You can still tap an answer.");
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

  const speechFeedbackMatch = React.useMemo(() => {
    if (!speechPracticePhrase || !speechFeedbackTranscript.trim()) {
      return null;
    }

    return compareTranscriptToOption(speechFeedbackTranscript, speechPracticePhrase);
  }, [speechFeedbackTranscript, speechPracticePhrase]);

  const liveSpeechFeedbackMessage = speechFeedbackTranscript.trim()
    ? speechMessage
    : selectedOption
      ? `Say this: ${speechPracticePhrase}`
      : "Tap an answer, then press Start Speaking.";
  const speechFeedbackWords = React.useMemo(() => {
    if (!speechFeedbackMatch) {
      return [];
    }

    return speechFeedbackMatch.wordFeedback.map((word, index) =>
      correctedRetryWordIndexes.includes(index)
        ? {
            ...word,
            heardWord: word.targetWord,
            status: "matched" as const,
          }
        : word,
    );
  }, [correctedRetryWordIndexes, speechFeedbackMatch]);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Header title="Child Mode" subtitle={`Room: ${roomId}`} onBack={undefined} />

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
            Tap an answer, then practise saying it.
          </Text>

          <View style={styles.choiceList}>
            <View style={styles.speechPracticeCard}>
              <Text style={styles.speechPracticeTitle}>Try saying your answer</Text>
              <Text style={styles.speechPracticeHint}>
                {selectedOption
                  ? `Say this: ${speechPracticePhrase}`
                  : "Tap a card first. You can still send by tapping only."}
              </Text>
              <View style={styles.speechSupportBoard}>
                {session.options.map((option) => (
                  <View
                    key={option.id}
                    style={[
                      styles.speechSupportChip,
                      option.id === selectedOptionId && styles.speechSupportChipSelected,
                    ]}
                  >
                    <Text style={styles.speechSupportChipText}>{option.label}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[
                  styles.speechListenButton,
                  isListening && styles.speechListenButtonActive,
                ]}
                onPress={isListening ? stopListening : startListening}
              >
                <Text style={styles.speechListenButtonText}>
                  {isListening ? "Stop listening" : "Start speaking"}
                </Text>
              </TouchableOpacity>
              {liveTranscript ? (
                <Text style={styles.speechLiveTranscript}>
                  Live: {liveTranscript}
                </Text>
              ) : null}
              <View style={styles.liveSpeechFeedbackBox}>
                {speechFeedbackMatch ? (
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
              <Text style={styles.speechFallbackLabel}>Tester transcript</Text>
              <TextInput
                value={mockTranscript}
                onChangeText={handleMockTranscriptChange}
                placeholder="Type the phrase to test"
                placeholderTextColor="#A8978B"
                style={styles.speechTranscriptInput}
              />
              <Text style={styles.speechPracticeMessage}>{speechMessage}</Text>
            </View>

            {session.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={option.id === selectedOptionId}
                onPress={() => {
                  setSelectedOptionId(option.id);
                  setSelectionSource("tap");
                  setMockTranscript("");
                  setLiveTranscript("");
                  setSpeechFeedbackTranscript("");
                  setSpeechError(null);
                  setRetryWordIndex(null);
                  setCorrectedRetryWordIndexes([]);
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
                ? `${selectedOption.label} is selected. Press Send Answer when ready.`
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

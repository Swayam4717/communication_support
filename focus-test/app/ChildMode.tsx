import React from "react";
import {
  Alert,
  AppState,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type AppStateStatus,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import type { CommunicationSession, SpeechWordFeedback } from "./communicationHelpers";
import {
  DEFAULT_SPEECH_ASSISTANT_ENABLED,
  DEFAULT_VISUAL_ONLY_MODE,
  getSpeechPracticePhrase,
  splitSpeechWords,
  stripBoldMarkers,
  subscribeToSession,
  submitAnswer,
} from "./communicationHelpers";
import { FormattedQuestionText, OptionCard } from "./communicationUI";
import { styles } from "./communicationCommon";
import FocusAlertModule from "../modules/focus-alert";

interface ChildModeScreenProps {
  roomId: string;
  openActiveSessionDirectly?: boolean;
  onOpenActiveSessionHandled?: () => void;
  onResetSetup: () => void;
}

const WEAK_STARTER_WORDS = new Set(["i"]);
const PARENT_SETTINGS_PASSWORD = "parent";

function splitSpeechUnits(phrase: string) {
  return phrase
    .split(/([.!?,;:])/)
    .reduce<string[]>((units, part, index, parts) => {
      if (!part || /[.!?,;:]/.test(part)) {
        return units;
      }

      const words = splitSpeechWords(part);

      for (let wordIndex = 0; wordIndex < words.length; ) {
        const isClauseStart =
          wordIndex === 0 &&
          (index === 0 || /[.!?,;:]/.test(parts[index - 1] ?? ""));
        const unitSize = isClauseStart && words.length > 1 ? 2 : 1;
        units.push(words.slice(wordIndex, wordIndex + unitSize).join(" "));
        wordIndex += unitSize;
      }

      return units;
    }, []);
}

function matchSpeechUnit(
  targetUnit: string,
  transcriptWords: string[],
  transcriptIndex: number,
) {
  const targetWords = splitSpeechWords(targetUnit);
  const heardWords = transcriptWords.slice(
    transcriptIndex,
    transcriptIndex + targetWords.length,
  );
  const isExactUnitMatch =
    targetWords.length > 0 &&
    targetWords.every((word, index) => heardWords[index] === word);

  if (isExactUnitMatch) {
    return {
      matched: true,
      consumedWordCount: targetWords.length,
    };
  }

  if (
    targetWords.length > 1 &&
    WEAK_STARTER_WORDS.has(targetWords[0]) &&
    transcriptWords[transcriptIndex] === targetWords[1]
  ) {
    return {
      matched: true,
      consumedWordCount: 1,
    };
  }

  return {
    matched: false,
    consumedWordCount: 0,
  };
}

function getDisplaySpeechUnit(unit: string) {
  const cleanedUnit = stripBoldMarkers(unit).trim();

  if (!cleanedUnit) {
    return "";
  }

  return cleanedUnit.charAt(0).toUpperCase() + cleanedUnit.slice(1);
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
export default function ChildModeScreen({
  roomId,
  openActiveSessionDirectly = false,
  onOpenActiveSessionHandled,
  onResetSetup,
}: ChildModeScreenProps) {
  // This screen mirrors the room document, steps through the child flow, and triggers the focus alert when a new session arrives.
  const [session, setSession] = React.useState<CommunicationSession | null>(null);
  const [stage, setStage] = React.useState<"idle" | "incoming" | "choice" | "confirmation">("idle");
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null);
  const [selectionSource, setSelectionSource] = React.useState<"tap" | "speech" | "typedPractice" | null>(null);
  const [mockTranscript, setMockTranscript] = React.useState("");
  const [isListening, setIsListening] = React.useState(false);
  const [, setIsAutoListenEnabled] = React.useState(false);
  const [, setLiveTranscript] = React.useState("");
  const [, setSpeechFeedbackTranscript] = React.useState("");
  const [, setSpeechError] = React.useState<string | null>(null);
  const [, setSpeechMessage] = React.useState("Tap an answer, then practise saying it.");
  const [, setSpeechFeedbackCard] = React.useState<null>(null);
  const [completedPracticeWordCount, setCompletedPracticeWordCount] = React.useState(0);
  const [isTesterModeEnabled, setIsTesterModeEnabled] = React.useState(false);
  const [practicePhraseTapCount, setPracticePhraseTapCount] = React.useState(0);
  const [isParentSettingsOpen, setIsParentSettingsOpen] = React.useState(false);
  const [parentSettingsPassword, setParentSettingsPassword] = React.useState("");
  const [parentSettingsError, setParentSettingsError] = React.useState("");
  const previousSessionIdRef = React.useRef<string | null>(null);
  const autoListenEnabledRef = React.useRef(false);
  const isSpeechStartingRef = React.useRef(false);
  const suppressExitReminderUntilRef = React.useRef(0);
  const restartListeningTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedPracticeWordCountRef = React.useRef(0);
  const selectedOptionIdRef = React.useRef<string | null>(null);
  const autoStartedSpeechKeyRef = React.useRef<string | null>(null);
  const readySoundKeyRef = React.useRef<string | null>(null);
  const hasPlayedTrySoundForCurrentAttemptRef = React.useRef(false);
  const successSoundKeyRef = React.useRef<string | null>(null);
  const directOpenedSessionIdRef = React.useRef<string | null>(null);
  const stageRef = React.useRef(stage);
  const sessionRef = React.useRef<CommunicationSession | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  const hasInitializedAppStateRef = React.useRef(false);
  const answerSubmittedRef = React.useRef(false);
  const hasShownLocalReminderForCurrentExitRef = React.useRef(false);
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
    autoStartedSpeechKeyRef.current = null;
    readySoundKeyRef.current = null;
    hasPlayedTrySoundForCurrentAttemptRef.current = false;
    successSoundKeyRef.current = null;
  }, []);
  const clearQuestionLocalState = React.useCallback(() => {
    answerSubmittedRef.current = false;
    hasShownLocalReminderForCurrentExitRef.current = false;
    autoListenEnabledRef.current = false;
    isSpeechStartingRef.current = false;
    suppressExitReminderUntilRef.current = 0;
    setIsAutoListenEnabled(false);
    clearRestartListeningTimer();
    abortSpeechRecognition();
    setIsListening(false);
    resetSpeechPracticeState();
  }, [
    abortSpeechRecognition,
    clearRestartListeningTimer,
    resetSpeechPracticeState,
  ]);
  const openActiveQuestion = React.useCallback(
    (
      activeSession: CommunicationSession,
      options: { resetLocalReminderLatch?: boolean } = {},
    ) => {
      if (
        stageRef.current === "choice" &&
        directOpenedSessionIdRef.current === activeSession.id
      ) {
        if (options.resetLocalReminderLatch) {
          hasShownLocalReminderForCurrentExitRef.current = false;
          appStateRef.current = "active";
        }

        return;
      }

      clearQuestionLocalState();
      directOpenedSessionIdRef.current = activeSession.id;
      previousSessionIdRef.current = activeSession.id;
      stageRef.current = "choice";
      appStateRef.current = "active";

      if (
        activeSession.status === "sent" &&
        activeSession.id &&
        !activeSession.selectedAnswer
      ) {
        answerSubmittedRef.current = false;
      }

      setStage("choice");
    },
    [clearQuestionLocalState],
  );
  React.useEffect(() => {
    selectedOptionIdRef.current = selectedOptionId;
  }, [selectedOptionId]);

  React.useEffect(() => {
    completedPracticeWordCountRef.current = completedPracticeWordCount;
  }, [completedPracticeWordCount]);

  React.useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  React.useEffect(() => {
    sessionRef.current = session;

    if (!session || session.status === "idle") {
      answerSubmittedRef.current = false;
      hasShownLocalReminderForCurrentExitRef.current = false;
    }
    if (session?.status === "answered") {
      answerSubmittedRef.current = true;
      hasShownLocalReminderForCurrentExitRef.current = true;
    }
  }, [session]);
// Subscribe to session updates for the given roomId and update local state accordingly
 React.useEffect(() => {
  const unsub = subscribeToSession((s) => {
    setSession(s);
// Update the child stage based on the current room status.
// Handle session status changes to update the UI stage and trigger alerts
    if (!s || s.status === "idle") {
      clearQuestionLocalState();
      setStage("idle");
      previousSessionIdRef.current = s?.id ?? null;
      directOpenedSessionIdRef.current = null;
      return;
    }

    if (s.status === "sent") {
      if (s.id !== previousSessionIdRef.current) {
        clearQuestionLocalState();
      }

      previousSessionIdRef.current = s.id;
      if (
        openActiveSessionDirectly ||
        directOpenedSessionIdRef.current === s.id
      ) {
        openActiveQuestion(s, {
          resetLocalReminderLatch: openActiveSessionDirectly,
        });
        if (openActiveSessionDirectly) {
          onOpenActiveSessionHandled?.();
        }
      } else {
        setStage("incoming");
      }
      return;
    }

    if (s.status === "answered") {
      answerSubmittedRef.current = true;
      previousSessionIdRef.current = s.id;
      directOpenedSessionIdRef.current = null;
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      setStage("confirmation");
    }
  }, roomId);

  return () => unsub();
}, [
  clearQuestionLocalState,
  onOpenActiveSessionHandled,
  openActiveQuestion,
  openActiveSessionDirectly,
  roomId,
]);

  React.useEffect(() => {
    appStateRef.current = AppState.currentState;
    hasInitializedAppStateRef.current = false;
    const initializationTimer = setTimeout(() => {
      hasInitializedAppStateRef.current = true;
    }, 0);

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (!hasInitializedAppStateRef.current) {
        hasInitializedAppStateRef.current = true;
        return;
      }

      const currentSession = sessionRef.current;
      const isSpeechStartupNoise =
        isSpeechStartingRef.current || Date.now() < suppressExitReminderUntilRef.current;
      const shouldShowLocalReminder =
        previousState === "active" &&
        nextState === "background" &&
        stageRef.current === "choice" &&
        currentSession?.status === "sent" &&
        !!currentSession.id &&
        !currentSession.selectedAnswer &&
        !answerSubmittedRef.current &&
        !hasShownLocalReminderForCurrentExitRef.current &&
        !isSpeechStartupNoise;

      if (!shouldShowLocalReminder) {
        return;
      }

      hasShownLocalReminderForCurrentExitRef.current = true;

      try {
        FocusAlertModule.showOverlayAlert();
      } catch (error) {
        console.warn("Could not show local exit reminder overlay", error);
      }
    });

    return () => {
      clearTimeout(initializationTimer);
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    if (stage !== "choice" && isListening) {
      autoListenEnabledRef.current = false;
      isSpeechStartingRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      abortSpeechRecognition();
      setIsListening(false);
    }
  }, [abortSpeechRecognition, clearRestartListeningTimer, isListening, stage]);

  const selectedOption = session?.options.find((o) => o.id === selectedOptionId) ?? null;
  const isVisualOnlyMode = session?.visualOnlyMode ?? DEFAULT_VISUAL_ONLY_MODE;
  const isSpeechAssistantEnabled =
    session?.speechAssistantEnabled ?? DEFAULT_SPEECH_ASSISTANT_ENABLED;
  const speechPracticePhrase = selectedOption
    ? getSpeechPracticePhrase(selectedOption.label, session?.speechTemplate ?? undefined)
    : "";
  const speechPracticeWords = React.useMemo(
    () => splitSpeechUnits(speechPracticePhrase),
    [speechPracticePhrase],
  );
  const submitSelectedAnswer = React.useCallback(async () => {
    if (!selectedOption || answerSubmittedRef.current) {
      return;
    }

    try {
      answerSubmittedRef.current = true;
      autoListenEnabledRef.current = false;
      isSpeechStartingRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      abortSpeechRecognition();
      setIsListening(false);
      await submitAnswer(selectedOption.id, roomId);
    } catch (e) {
      answerSubmittedRef.current = false;
      console.warn("submitAnswer failed", e);
      Alert.alert("Could not send", "Please try again.");
    }
  }, [
    abortSpeechRecognition,
    clearRestartListeningTimer,
    roomId,
    selectedOption,
  ]);
  const startRecognitionSession = React.useCallback(() => {
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      maxAlternatives: 1,
      contextualStrings: speechPracticePhrase ? [speechPracticePhrase] : [],
    });
    isSpeechStartingRef.current = false;
    setIsListening(true);
  }, [speechPracticePhrase]);
  const scheduleListeningRestart = React.useCallback(() => {
    clearRestartListeningTimer();

    if (
      !autoListenEnabledRef.current ||
      isVisualOnlyMode ||
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
        isVisualOnlyMode ||
        stageRef.current !== "choice" ||
        !selectedOptionIdRef.current ||
        completedPracticeWordCountRef.current >= speechPracticeWords.length
      ) {
        return;
      }

      try {
        startRecognitionSession();
      } catch {
        isSpeechStartingRef.current = false;
        setIsListening(false);
        autoListenEnabledRef.current = false;
        setIsAutoListenEnabled(false);
        setSpeechError(null);
        setSpeechMessage("Listening will start when ready.");
      }
    }, 600);
  }, [
    clearRestartListeningTimer,
    isVisualOnlyMode,
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
    const targetUnits = splitSpeechUnits(practicePhrase);
    const transcriptWords = splitSpeechWords(value);

    if (targetUnits.length === 0 || transcriptWords.length === 0) {
      return;
    }

    let nextTargetIndex = completedPracticeWordCount;
    let transcriptIndex = 0;

    for (
      let completedIndex = 0;
      completedIndex < nextTargetIndex && transcriptIndex < transcriptWords.length;
      completedIndex += 1
    ) {
      const completedUnitMatch = matchSpeechUnit(
        targetUnits[completedIndex],
        transcriptWords,
        transcriptIndex,
      );

      if (!completedUnitMatch.matched) {
        transcriptIndex = 0;
        break;
      }

      transcriptIndex += completedUnitMatch.consumedWordCount;
    }

    for (
      let wordIndex = transcriptIndex;
      wordIndex < transcriptWords.length && nextTargetIndex < targetUnits.length;
    ) {
      const nextTargetUnit = targetUnits[nextTargetIndex];
      const unitMatch = matchSpeechUnit(nextTargetUnit, transcriptWords, wordIndex);

      if (!unitMatch.matched) {
        setCompletedPracticeWordCount(0);
        completedPracticeWordCountRef.current = 0;
        if (!hasPlayedTrySoundForCurrentAttemptRef.current) {
          hasPlayedTrySoundForCurrentAttemptRef.current = true;
          try {
            FocusAlertModule.playPracticeSound("try");
          } catch {
            // Sound feedback is optional; speech practice should keep working.
          }
        }
        setSpeechMessage("");
        setSpeechFeedbackCard(null);
        return;
      }

      nextTargetIndex += 1;
      wordIndex += unitMatch.consumedWordCount;
    }

    setCompletedPracticeWordCount(nextTargetIndex);
    completedPracticeWordCountRef.current = nextTargetIndex;

    if (nextTargetIndex >= targetUnits.length) {
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      abortSpeechRecognition();
      setIsListening(false);
      setSelectionSource(selectionSource === "tap" ? "tap" : source);
      const successKey = `${session.id}:${selectedOptionId}`;
      if (successSoundKeyRef.current !== successKey) {
        successSoundKeyRef.current = successKey;
        try {
          FocusAlertModule.playPracticeSound("success");
        } catch {
          // Sound feedback is optional; speech practice should keep working.
        }
      }
      setSpeechMessage("");
      setSpeechFeedbackCard(null);
      if (!isVisualOnlyMode) {
        void submitSelectedAnswer();
      }
      return;
    }

    setSpeechMessage("");
    setSpeechFeedbackCard(null);
  }, [
    abortSpeechRecognition,
    clearRestartListeningTimer,
    completedPracticeWordCount,
    isVisualOnlyMode,
    selectedOptionId,
    selectionSource,
    session,
    submitSelectedAnswer,
  ]);

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
    isSpeechStartingRef.current = false;
    hasPlayedTrySoundForCurrentAttemptRef.current = false;
    scheduleListeningRestart();
  });

  useSpeechRecognitionEvent("error", () => {
    setIsListening(false);
    isSpeechStartingRef.current = false;
    hasPlayedTrySoundForCurrentAttemptRef.current = false;
    if (autoListenEnabledRef.current) {
      scheduleListeningRestart();
      return;
    }

    setSpeechError(null);
    setSpeechMessage("Listening will start when ready.");
  });

  React.useEffect(() => {
    return () => {
      autoListenEnabledRef.current = false;
      isSpeechStartingRef.current = false;
      clearRestartListeningTimer();
      ExpoSpeechRecognitionModule.abort();
    };
  }, [clearRestartListeningTimer]);

  const startListening = React.useCallback(async () => {
    try {
      isSpeechStartingRef.current = true;
      suppressExitReminderUntilRef.current = Date.now() + 2000;
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted || !ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        isSpeechStartingRef.current = false;
        autoListenEnabledRef.current = false;
        setIsAutoListenEnabled(false);
        setSpeechError(null);
        setSpeechMessage("You can still send your answer.");
        return;
      }

      setLiveTranscript("");
      setSpeechFeedbackTranscript("");
      setSpeechError(null);
      setSpeechFeedbackCard(null);
      hasPlayedTrySoundForCurrentAttemptRef.current = false;
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
      isSpeechStartingRef.current = false;
      setIsListening(false);
      autoListenEnabledRef.current = false;
      setIsAutoListenEnabled(false);
      setSpeechError(null);
      setSpeechMessage("You can still send your answer.");
    }
  }, [clearRestartListeningTimer, selectedOptionId, startRecognitionSession]);

  React.useEffect(() => {
    if (stage !== "choice" || !session?.id || !selectedOptionId || isVisualOnlyMode) {
      return;
    }

    const speechKey = `${session.id}:${selectedOptionId}`;

    if (autoStartedSpeechKeyRef.current === speechKey) {
      return;
    }

    autoStartedSpeechKeyRef.current = speechKey;
    if (readySoundKeyRef.current !== speechKey) {
      readySoundKeyRef.current = speechKey;
      try {
        FocusAlertModule.playPracticeSound("ready");
      } catch {
        // Sound feedback is optional; speech practice should keep working.
      }
    }
    void startListening();
  }, [isVisualOnlyMode, selectedOptionId, session?.id, stage, startListening]);

  React.useEffect(() => {
    if (!isVisualOnlyMode) {
      return;
    }

    autoListenEnabledRef.current = false;
    isSpeechStartingRef.current = false;
    setIsAutoListenEnabled(false);
    clearRestartListeningTimer();
    abortSpeechRecognition();
    setIsListening(false);
  }, [abortSpeechRecognition, clearRestartListeningTimer, isVisualOnlyMode]);

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
        <TouchableOpacity
          accessibilityLabel="Parent settings"
          style={styles.childSettingsIconButton}
          onPress={() => {
            setIsParentSettingsOpen((isOpen) => !isOpen);
            setParentSettingsPassword("");
            setParentSettingsError("");
          }}
        >
          <MaterialCommunityIcons name="wrench-outline" size={18} color="#8A7566" />
        </TouchableOpacity>
        {isParentSettingsOpen ? (
          <View style={styles.childSettingsPanel}>
            <Text style={styles.childSettingsLabel}>Parent settings</Text>
            <TextInput
              value={parentSettingsPassword}
              onChangeText={(value) => {
                setParentSettingsPassword(value);
                setParentSettingsError("");
              }}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor="#A8978B"
              style={styles.childSettingsInput}
            />
            {parentSettingsError ? (
              <Text style={styles.childSettingsError}>{parentSettingsError}</Text>
            ) : null}
            <View style={styles.childSettingsActions}>
              <TouchableOpacity
                style={styles.childSettingsCancelButton}
                onPress={() => {
                  setIsParentSettingsOpen(false);
                  setParentSettingsPassword("");
                  setParentSettingsError("");
                }}
              >
                <Text style={styles.childSettingsCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.childSettingsResetButton}
                onPress={() => {
                  if (parentSettingsPassword.trim() !== PARENT_SETTINGS_PASSWORD) {
                    setParentSettingsError("Password not accepted.");
                    return;
                  }

                  setIsParentSettingsOpen(false);
                  setParentSettingsPassword("");
                  setParentSettingsError("");
                  onResetSetup();
                }}
              >
                <Text style={styles.childSettingsResetText}>Reset setup</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
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
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              openActiveQuestion(session, { resetLocalReminderLatch: true })
            }
          >
            <Text style={styles.primaryButtonText}>Start</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "choice" ? (
        <>
          <View style={styles.choiceCard}>
            <FormattedQuestionText
              text={session.title}
              style={styles.questionTitle}
              boldStyle={styles.questionTitleBold}
            />

            <View style={styles.choiceList}>
              {session.options.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  compact
                  selected={option.id === selectedOptionId}
                  onPress={() => {
                    autoListenEnabledRef.current = false;
                    isSpeechStartingRef.current = false;
                    setIsAutoListenEnabled(false);
                    clearRestartListeningTimer();
                    abortSpeechRecognition();
                    setIsListening(false);
                    selectedOptionIdRef.current = option.id;
                    completedPracticeWordCountRef.current = 0;
                    hasPlayedTrySoundForCurrentAttemptRef.current = false;
                    setSelectedOptionId(option.id);
                    setSelectionSource("tap");
                    setMockTranscript("");
                    setLiveTranscript("");
                    setSpeechFeedbackTranscript("");
                    setSpeechError(null);
                    setCompletedPracticeWordCount(0);
                    setSpeechFeedbackCard(null);
                    setSpeechMessage("");
                  }}
                />
              ))}
            </View>

            <View style={styles.childSectionDivider} />

          {!isVisualOnlyMode && selectedOption ? (
            <View style={styles.speechPracticeCard}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handlePracticePhrasePress}
              >
                <View style={styles.speechTargetPhraseRow}>
                  <MaterialCommunityIcons
                    name="account-voice"
                    size={20}
                    color="#7F1F1A"
                  />
                  <FormattedQuestionText
                    text={speechPracticePhrase}
                    style={styles.speechTargetPhraseText}
                    boldStyle={styles.speechTargetPhraseTextBold}
                  />
                </View>
              </TouchableOpacity>
              {isSpeechAssistantEnabled ? (
                speechFeedbackWords.length > 0 ? (
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
                          {getDisplaySpeechUnit(word.targetWord)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null
              ) : null}
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
            </View>
          ) : null}

          </View>

          {isVisualOnlyMode ? (
            <TouchableOpacity
              disabled={!selectedOption}
              style={[
                styles.primaryButton,
                styles.childSendButtonBottom,
                !selectedOption && styles.primaryButtonDisabled,
              ]}
              onPress={submitSelectedAnswer}
            >
              <Text style={styles.primaryButtonText}>Send Answer</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      {session && stage === "confirmation" && (session.selectedAnswer || selectedOption) ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>✓</Text>
          <Text style={styles.heroTitle}>Sent to Mum</Text>
          <FormattedQuestionText
            text={`You chose ${
              session?.options.find((o) => o.id === session.selectedAnswer)?.label ??
              selectedOption?.label ??
              ""
            }`}
            style={styles.heroSubtitle}
            boldStyle={styles.optionLabelBold}
          />
          <Text style={styles.confirmationEmoji}>{session?.options.find((o) => o.id === session.selectedAnswer)?.emoji ?? selectedOption?.emoji}</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (session.status === "sent") {
                openActiveQuestion(session, { resetLocalReminderLatch: true });
                return;
              }

              setStage("idle");
            }}
          >
            <Text style={styles.primaryButtonText}>
              {session.status === "sent" ? "Take me to question" : "Done"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

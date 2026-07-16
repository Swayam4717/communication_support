import React from "react";
import {
  Alert,
  AppState,
  Platform,
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

const PARENT_SETTINGS_PASSWORD = "1239";
const DEBUG_SPEECH_MATCHING = true;
const HOMOPHONE_GROUPS = [
  ["to", "too", "two", "2"],
  ["for", "four", "4"],
  ["ate", "eight", "8"],
  ["one", "won", "1"],
  ["there", "their", "theyre"],
  ["here", "hear"],
  ["no", "know"],
  ["right", "write"],
  ["see", "sea"],
  ["be", "bee"],
  ["by", "buy", "bye"],
  ["wait", "weight"],
  ["eye", "i"],
  ["our", "hour"],
  ["are", "r"],
  ["you", "u"],
  ["your", "youre"],
  ["where", "wear"],
  ["whole", "hole"],
  ["some", "sum"],
];
const HOMOPHONE_TOKEN_GROUPS = HOMOPHONE_GROUPS.reduce<Record<string, Set<string>>>(
  (groups, group) => {
    const normalizedGroup = new Set(group.map((token) => normalizeSpeechToken(token)));

    normalizedGroup.forEach((token) => {
      groups[token] = normalizedGroup;
    });

    return groups;
  },
  {},
);

function normalizeSpeechToken(token: string) {
  return token
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\w]/g, "")
    .trim();
}

function splitPracticeSpeechTokens(text: string) {
  return stripBoldMarkers(text)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(normalizeSpeechToken)
    .filter(Boolean);
}

function speechTokensMatch(expectedToken: string, transcriptToken: string) {
  const expected = normalizeSpeechToken(expectedToken);
  const heard = normalizeSpeechToken(transcriptToken);

  if (!expected || !heard) {
    return false;
  }

  if (expected === heard) {
    return true;
  }

  return HOMOPHONE_TOKEN_GROUPS[expected]?.has(heard) ?? false;
}

function groupSpeechTokens(tokens: string[]) {
  const groups: string[] = [];
  let remaining = tokens.length;
  let index = 0;

  while (remaining > 0) {
    let groupSize = 3;

    if (remaining === 1) {
      groupSize = 1;
    } else if (remaining === 2 || remaining === 4) {
      groupSize = 2;
    }

    groups.push(tokens.slice(index, index + groupSize).join(" "));
    index += groupSize;
    remaining -= groupSize;
  }

  return groups;
}

function splitSpeechUnits(phrase: string) {
  return phrase
    .split(/([.!?,;:])/)
    .reduce<string[]>((units, part, index, parts) => {
      if (!part || /[.!?,;:]/.test(part)) {
        return units;
      }

      const words = splitPracticeSpeechTokens(part);
      units.push(...groupSpeechTokens(words));

      return units;
    }, []);
}

function getDisplaySpeechUnit(unit: string) {
  const cleanedUnit = stripBoldMarkers(unit).trim();

  if (!cleanedUnit) {
    return "";
  }

  return cleanedUnit.charAt(0).toUpperCase() + cleanedUnit.slice(1);
}

function isPartialSpeechTokenAttempt(targetToken: string, transcriptTokens: string[]) {
  if (!targetToken || transcriptTokens.length === 0) {
    return false;
  }

  const heardToken = normalizeSpeechToken(transcriptTokens[0] ?? "");
  const normalizedTarget = normalizeSpeechToken(targetToken);
  return !!heardToken && (normalizedTarget.startsWith(heardToken) || heardToken.length <= 2);
}

function logSpeechMatch(message: string, details: Record<string, unknown>) {
  if (!DEBUG_SPEECH_MATCHING) {
    return;
  }

  console.log("[GuidedSpeechDebug]", message, details);
}

function cleanRecognizedTranscript(transcript: string) {
  return transcript.replace(/\s+/g, " ").trim();
}

function mergeRecognizedTranscript(currentTranscript: string, nextTranscript: string) {
  const current = cleanRecognizedTranscript(currentTranscript);
  const next = cleanRecognizedTranscript(nextTranscript);

  if (!next) {
    return current;
  }

  if (!current) {
    return next;
  }

  const currentLower = current.toLowerCase();
  const nextLower = next.toLowerCase();

  if (nextLower.startsWith(currentLower)) {
    return next;
  }

  if (currentLower.endsWith(nextLower)) {
    return current;
  }

  const currentWords = current.split(" ");
  const nextWords = next.split(" ");
  const maxOverlap = Math.min(currentWords.length, nextWords.length);

  for (let overlapSize = maxOverlap; overlapSize > 0; overlapSize -= 1) {
    const currentTail = currentWords
      .slice(currentWords.length - overlapSize)
      .join(" ")
      .toLowerCase();
    const nextHead = nextWords.slice(0, overlapSize).join(" ").toLowerCase();

    if (currentTail === nextHead) {
      return [...currentWords, ...nextWords.slice(overlapSize)].join(" ");
    }
  }

  return `${current} ${next}`;
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
  const [selectionSource, setSelectionSource] = React.useState<"tap" | "speech" | null>(null);
  const [isListening, setIsListening] = React.useState(false);
  const [, setIsAutoListenEnabled] = React.useState(false);
  const [, setLiveTranscript] = React.useState("");
  const [accumulatedTranscript, setAccumulatedTranscript] = React.useState("");
  const [, setSpeechError] = React.useState<string | null>(null);
  const [, setSpeechMessage] = React.useState("Tap an answer, then practise saying it.");
  const [, setSpeechFeedbackCard] = React.useState<null>(null);
  const [completedPracticeWordCount, setCompletedPracticeWordCount] = React.useState(0);
  const [isParentSettingsOpen, setIsParentSettingsOpen] = React.useState(false);
  const [parentSettingsPassword, setParentSettingsPassword] = React.useState("");
  const [parentSettingsError, setParentSettingsError] = React.useState("");
  const previousSessionIdRef = React.useRef<string | null>(null);
  const autoListenEnabledRef = React.useRef(false);
  const wantsSpeechListeningRef = React.useRef(false);
  const isSpeechStartingRef = React.useRef(false);
  const suppressExitReminderUntilRef = React.useRef(0);
  const restartListeningTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedPracticeWordCountRef = React.useRef(0);
  const accumulatedTranscriptRef = React.useRef("");
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
  const isSpeakingTargetRef = React.useRef(false);
  const isVisualOnlyModeRef = React.useRef(DEFAULT_VISUAL_ONLY_MODE);
  const clearRestartListeningTimer = React.useCallback(() => {
    if (restartListeningTimerRef.current) {
      clearTimeout(restartListeningTimerRef.current);
      restartListeningTimerRef.current = null;
    }
  }, []);
  const setWantsSpeechListening = React.useCallback((wantsListening: boolean, reason: string) => {
    wantsSpeechListeningRef.current = wantsListening;
    console.log(`Guided speech wantsSpeechListening ${wantsListening}: ${reason}`);
  }, []);
  const abortSpeechRecognition = React.useCallback((reason = "recognition stopped") => {
    setWantsSpeechListening(false, reason);
    if (Platform.OS === "android") {
      try {
        console.log("Android native SpeechRecognizer stop requested from JS");
        void FocusAlertModule.cancelAndroidSpeechRecognition();
      } catch {
        // Speech recognition can already be stopped when session state changes.
      }
      return;
    }

    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Speech recognition can already be stopped when session state changes.
    }
  }, [setWantsSpeechListening]);

  const resetSpeechPracticeState = React.useCallback(() => {
    setSelectedOptionId(null);
    setSelectionSource(null);
    setLiveTranscript("");
    setAccumulatedTranscript("");
    accumulatedTranscriptRef.current = "";
    setSpeechError(null);
    setSpeechMessage("Tap an answer, then practise saying it.");
    setSpeechFeedbackCard(null);
    setCompletedPracticeWordCount(0);
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
    setWantsSpeechListening(false, "question local state cleared");
    isSpeechStartingRef.current = false;
    isSpeakingTargetRef.current = false;
    suppressExitReminderUntilRef.current = 0;
    setIsAutoListenEnabled(false);
    clearRestartListeningTimer();
    abortSpeechRecognition();
    try {
      FocusAlertModule.stopPracticeSpeech();
    } catch {
      // Target phrase speech is optional; navigation should keep working.
    }
    setIsListening(false);
    resetSpeechPracticeState();
  }, [
    abortSpeechRecognition,
    clearRestartListeningTimer,
    resetSpeechPracticeState,
    setWantsSpeechListening,
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
      setWantsSpeechListening(false, "session answered");
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
  setWantsSpeechListening,
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
  const spokenPracticePhrase = React.useMemo(
    () =>
      stripBoldMarkers(speechPracticePhrase)
        .replace(/[\[\]]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    [speechPracticePhrase],
  );
  const speechPracticeWords = React.useMemo(() => {
    const units = splitSpeechUnits(speechPracticePhrase);

    logSpeechMatch("speech bubble groups", {
      phrase: speechPracticePhrase,
      groups: units,
    });

    return units;
  }, [speechPracticePhrase]);
  const speechPracticeTokens = React.useMemo(
    () => splitPracticeSpeechTokens(speechPracticePhrase),
    [speechPracticePhrase],
  );
  React.useEffect(() => {
    isVisualOnlyModeRef.current = isVisualOnlyMode;
  }, [isVisualOnlyMode]);

  const submitSelectedAnswer = React.useCallback(async () => {
    if (!selectedOption || answerSubmittedRef.current) {
      return;
    }

    try {
      answerSubmittedRef.current = true;
      autoListenEnabledRef.current = false;
      setWantsSpeechListening(false, "sentence completed; submitting answer");
      isSpeechStartingRef.current = false;
      isSpeakingTargetRef.current = false;
      setIsAutoListenEnabled(false);
      clearRestartListeningTimer();
      abortSpeechRecognition();
      try {
        FocusAlertModule.stopPracticeSpeech();
      } catch {
        // Target phrase speech is optional; answer submission should continue.
      }
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
    setWantsSpeechListening,
  ]);
  const startRecognitionSession = React.useCallback(() => {
    if (Platform.OS === "android") {
      console.log("Using Android native SpeechRecognizer");
      console.log("Android native SpeechRecognizer start requested from JS");
      void FocusAlertModule.startAndroidSpeechRecognition()
        .then(() => {
          isSpeechStartingRef.current = false;
          setIsListening(true);
        })
        .catch((error) => {
          console.warn("Android native SpeechRecognizer start failed", error);
          isSpeechStartingRef.current = false;
          setIsListening(false);
          autoListenEnabledRef.current = false;
          setWantsSpeechListening(false, "Android speech start failed");
          setIsAutoListenEnabled(false);
          setSpeechError(null);
          setSpeechMessage("Listening will start when ready.");
        });
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      maxAlternatives: 1,
      contextualStrings: speechPracticePhrase ? [speechPracticePhrase] : [],
    });
    isSpeechStartingRef.current = false;
    setIsListening(true);
  }, [setWantsSpeechListening, speechPracticePhrase]);
  const scheduleListeningRestart = React.useCallback(() => {
    clearRestartListeningTimer();

    if (
      !autoListenEnabledRef.current ||
      isSpeakingTargetRef.current ||
      isVisualOnlyMode ||
      stageRef.current !== "choice" ||
      !selectedOptionIdRef.current ||
      completedPracticeWordCountRef.current >= speechPracticeTokens.length
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
        isSpeakingTargetRef.current ||
        isVisualOnlyMode ||
        stageRef.current !== "choice" ||
        !selectedOptionIdRef.current ||
        completedPracticeWordCountRef.current >= speechPracticeTokens.length
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
    speechPracticeTokens.length,
    startRecognitionSession,
  ]);
  const applyTranscriptMatch = React.useCallback((value: string, source: "speech") => {
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
    const targetTokens = splitPracticeSpeechTokens(practicePhrase);
    const transcriptTokens = splitPracticeSpeechTokens(value);

    if (targetTokens.length === 0 || transcriptTokens.length === 0) {
      return;
    }

    let nextTargetIndex = completedPracticeWordCountRef.current;
    let transcriptIndex = 0;
    let acceptedAnyToken = false;

    logSpeechMatch("result", {
      targetTokens,
      transcriptTokens,
      currentIndex: nextTargetIndex,
    });

    for (
      ;
      transcriptIndex < transcriptTokens.length && nextTargetIndex < targetTokens.length;
      transcriptIndex += 1
    ) {
      const transcriptToken = transcriptTokens[transcriptIndex];
      const expectedToken = targetTokens[nextTargetIndex];

      if (
        nextTargetIndex > 0 &&
        targetTokens
          .slice(0, nextTargetIndex)
          .some((targetToken) => speechTokensMatch(targetToken, transcriptToken))
      ) {
        logSpeechMatch("ignored repeated accepted token", {
          transcriptToken,
          currentIndex: nextTargetIndex,
        });
        continue;
      }

      if (speechTokensMatch(expectedToken, transcriptToken)) {
        nextTargetIndex += 1;
        acceptedAnyToken = true;
        hasPlayedTrySoundForCurrentAttemptRef.current = false;
        logSpeechMatch("accepted token", {
          expectedToken,
          acceptedToken: transcriptToken,
          acceptedByHomophone: expectedToken !== transcriptToken,
          nextIndex: nextTargetIndex,
        });
        continue;
      }

      if (isPartialSpeechTokenAttempt(expectedToken, [transcriptToken])) {
        logSpeechMatch("partial token; waiting", {
          expectedToken,
          transcriptToken,
          currentIndex: nextTargetIndex,
        });
        setSpeechMessage("");
        setSpeechFeedbackCard(null);
        return;
      }

      const didResetProgress = nextTargetIndex > 0;
      logSpeechMatch("reset", {
        reason: "wrong token",
        expectedToken,
        transcriptToken,
        currentIndex: nextTargetIndex,
      });
      setAccumulatedTranscript("");
      accumulatedTranscriptRef.current = "";
      setCompletedPracticeWordCount(0);
      completedPracticeWordCountRef.current = 0;
      if (
        didResetProgress &&
        !hasPlayedTrySoundForCurrentAttemptRef.current &&
        !isSpeakingTargetRef.current &&
        !isSpeechStartingRef.current
      ) {
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

    if (!acceptedAnyToken) {
      setSpeechMessage("");
      setSpeechFeedbackCard(null);
      return;
    }

    setCompletedPracticeWordCount(nextTargetIndex);
    completedPracticeWordCountRef.current = nextTargetIndex;

    if (nextTargetIndex >= targetTokens.length) {
      autoListenEnabledRef.current = false;
      setWantsSpeechListening(false, "phrase completed");
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
    isVisualOnlyMode,
    selectedOptionId,
    selectionSource,
    session,
    setWantsSpeechListening,
    submitSelectedAnswer,
  ]);

  const handleRecognizedTranscript = React.useCallback((rawTranscript: string) => {
    if (isSpeakingTargetRef.current || !wantsSpeechListeningRef.current) {
      return;
    }

    const transcript = cleanRecognizedTranscript(rawTranscript);

    if (!transcript) {
      return;
    }

    const mergedTranscript = mergeRecognizedTranscript(
      accumulatedTranscriptRef.current,
      transcript,
    );

    accumulatedTranscriptRef.current = mergedTranscript;
    setLiveTranscript(transcript);
    setAccumulatedTranscript(mergedTranscript);
    setSpeechError(null);
    logSpeechMatch("transcript merged", {
      rawTranscript,
      accumulatedTranscript: mergedTranscript,
      tokenProgress: completedPracticeWordCountRef.current,
    });
    applyTranscriptMatch(mergedTranscript, "speech");
  }, [applyTranscriptMatch]);

  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const handleAndroidSpeechTranscript = (payload: { transcript?: string }) => {
      handleRecognizedTranscript(payload.transcript ?? "");
    };

    const partialSubscription = FocusAlertModule.addListener(
      "androidSpeechPartialResult",
      handleAndroidSpeechTranscript,
    );
    const finalSubscription = FocusAlertModule.addListener(
      "androidSpeechFinalResult",
      handleAndroidSpeechTranscript,
    );
    const errorSubscription = FocusAlertModule.addListener(
      "androidSpeechError",
      (payload: { message?: string; code?: number }) => {
        console.warn("Android native SpeechRecognizer error", payload);
        setIsListening(false);
        isSpeechStartingRef.current = false;

        if (isSpeakingTargetRef.current) {
          return;
        }

        hasPlayedTrySoundForCurrentAttemptRef.current = false;
      },
    );
    const readySubscription = FocusAlertModule.addListener(
      "androidSpeechReady",
      () => {
        setIsListening(true);
        isSpeechStartingRef.current = false;
      },
    );
    const beginningSubscription = FocusAlertModule.addListener(
      "androidSpeechBeginning",
      () => {
        setIsListening(true);
        isSpeechStartingRef.current = false;
      },
    );
    const endSubscription = FocusAlertModule.addListener(
      "androidSpeechEnd",
      () => {
        setIsListening(false);
        isSpeechStartingRef.current = false;

        if (isSpeakingTargetRef.current) {
          return;
        }

        hasPlayedTrySoundForCurrentAttemptRef.current = false;
      },
    );

    return () => {
      partialSubscription.remove();
      finalSubscription.remove();
      errorSubscription.remove();
      readySubscription.remove();
      beginningSubscription.remove();
      endSubscription.remove();
    };
  }, [handleRecognizedTranscript]);

  useSpeechRecognitionEvent("result", (event) => {
    if (Platform.OS === "android") {
      return;
    }

    const transcript = event.results[0]?.transcript?.trim();

    handleRecognizedTranscript(transcript ?? "");
  });

  useSpeechRecognitionEvent("end", () => {
    if (Platform.OS === "android") {
      return;
    }

    setIsListening(false);
    isSpeechStartingRef.current = false;
    if (isSpeakingTargetRef.current) {
      return;
    }

    hasPlayedTrySoundForCurrentAttemptRef.current = false;
    scheduleListeningRestart();
  });

  useSpeechRecognitionEvent("error", () => {
    if (Platform.OS === "android") {
      return;
    }

    setIsListening(false);
    isSpeechStartingRef.current = false;
    if (isSpeakingTargetRef.current) {
      return;
    }

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
      setWantsSpeechListening(false, "component unmounted");
      isSpeechStartingRef.current = false;
      isSpeakingTargetRef.current = false;
      clearRestartListeningTimer();
      if (Platform.OS === "android") {
        void FocusAlertModule.destroyAndroidSpeechRecognition();
      } else {
        ExpoSpeechRecognitionModule.abort();
      }
      try {
        FocusAlertModule.stopPracticeSpeech();
      } catch {
        // Target phrase speech is optional; cleanup should keep working.
      }
    };
  }, [clearRestartListeningTimer, setWantsSpeechListening]);

  const startListening = React.useCallback(async () => {
    if (isSpeakingTargetRef.current) {
      return;
    }

    try {
      isSpeechStartingRef.current = true;
      suppressExitReminderUntilRef.current = Date.now() + 2000;

      if (Platform.OS !== "android") {
        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

        if (!permission.granted || !ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
          isSpeechStartingRef.current = false;
          autoListenEnabledRef.current = false;
          setWantsSpeechListening(false, "speech permission unavailable");
          setIsAutoListenEnabled(false);
          setSpeechError(null);
          setSpeechMessage("You can still send your answer.");
          return;
        }
      }

      setLiveTranscript("");
      setSpeechError(null);
      setSpeechFeedbackCard(null);
      hasPlayedTrySoundForCurrentAttemptRef.current = false;
      if (!selectedOptionId) {
        autoListenEnabledRef.current = false;
        setWantsSpeechListening(false, "no selected option");
        setIsAutoListenEnabled(false);
        setSpeechMessage("Choose an answer to practise first.");
        return;
      }

      autoListenEnabledRef.current = true;
      setWantsSpeechListening(true, "speech mode option selected");
      setIsAutoListenEnabled(true);
      clearRestartListeningTimer();
      setSpeechMessage("Listening... take your time");
      startRecognitionSession();
    } catch {
      isSpeechStartingRef.current = false;
      setIsListening(false);
      autoListenEnabledRef.current = false;
      setWantsSpeechListening(false, "start listening failed");
      setIsAutoListenEnabled(false);
      setSpeechError(null);
      setSpeechMessage("You can still send your answer.");
    }
  }, [
    clearRestartListeningTimer,
    selectedOptionId,
    setWantsSpeechListening,
    startRecognitionSession,
  ]);

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
    setWantsSpeechListening(false, "visual-only mode active");
    isSpeechStartingRef.current = false;
    isSpeakingTargetRef.current = false;
    setIsAutoListenEnabled(false);
    clearRestartListeningTimer();
    abortSpeechRecognition();
    try {
      FocusAlertModule.stopPracticeSpeech();
    } catch {
      // Target phrase speech is optional; visual-only mode should keep working.
    }
    setIsListening(false);
  }, [
    abortSpeechRecognition,
    clearRestartListeningTimer,
    isVisualOnlyMode,
    setWantsSpeechListening,
  ]);

  const handleTargetPhrasePress = React.useCallback(async () => {
    if (
      !session?.id ||
      !selectedOptionId ||
      isVisualOnlyMode ||
      !spokenPracticePhrase ||
      isSpeakingTargetRef.current
    ) {
      return;
    }

    const targetSessionId = session.id;
    const targetOptionId = selectedOptionId;

    isSpeakingTargetRef.current = true;
    autoListenEnabledRef.current = false;
    setWantsSpeechListening(false, "TTS target phrase started");
    isSpeechStartingRef.current = false;
    setIsAutoListenEnabled(false);
    clearRestartListeningTimer();
    abortSpeechRecognition();
    setIsListening(false);

    try {
      await FocusAlertModule.speakPracticePhrase(spokenPracticePhrase);
    } catch {
      // Text-to-speech is a helper only; speech practice can continue without it.
    } finally {
      isSpeakingTargetRef.current = false;

      const currentSession = sessionRef.current;
      const shouldRestartListening =
        currentSession?.id === targetSessionId &&
        currentSession.status === "sent" &&
        !currentSession.selectedAnswer &&
        stageRef.current === "choice" &&
        selectedOptionIdRef.current === targetOptionId &&
        !isVisualOnlyModeRef.current &&
        !answerSubmittedRef.current;

      if (shouldRestartListening) {
        suppressExitReminderUntilRef.current = Date.now() + 1000;
        void startListening();
      }
    }
  }, [
    abortSpeechRecognition,
    clearRestartListeningTimer,
    isVisualOnlyMode,
    selectedOptionId,
    session?.id,
    spokenPracticePhrase,
    startListening,
  ]);

  const speechFeedbackWords = React.useMemo<SpeechWordFeedback[]>(() => {
    let tokenStartIndex = 0;

    return speechPracticeWords.map((word) => {
      const tokenCount = splitPracticeSpeechTokens(word).length;
      const tokenEndIndex = tokenStartIndex + tokenCount;
      const status =
        completedPracticeWordCount >= tokenEndIndex
          ? "matched" as const
          : completedPracticeWordCount >= tokenStartIndex
            ? "current" as const
            : "pending" as const;
      tokenStartIndex = tokenEndIndex;

      return {
        targetWord: word,
        status,
      };
    });
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
                    isSpeakingTargetRef.current = false;
                    setIsAutoListenEnabled(false);
                    clearRestartListeningTimer();
                    abortSpeechRecognition();
                    try {
                      FocusAlertModule.stopPracticeSpeech();
                    } catch {
                      // Target phrase speech is optional; option selection should continue.
                    }
                    setIsListening(false);
                    selectedOptionIdRef.current = option.id;
                    completedPracticeWordCountRef.current = 0;
                    hasPlayedTrySoundForCurrentAttemptRef.current = false;
                    setSelectedOptionId(option.id);
                    setSelectionSource("tap");
                    setLiveTranscript("");
                    setAccumulatedTranscript("");
                    accumulatedTranscriptRef.current = "";
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
                onPress={handleTargetPhrasePress}
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
              <View style={styles.speechTranscriptBox}>
                <Text style={styles.speechTranscriptHeader}>You said</Text>
                <Text
                  style={[
                    styles.speechTranscriptText,
                    !accumulatedTranscript && styles.speechTranscriptPlaceholder,
                  ]}
                >
                  {accumulatedTranscript || "Listening..."}
                </Text>
              </View>
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

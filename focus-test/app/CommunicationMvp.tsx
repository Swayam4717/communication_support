import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  Button,
  Linking,
  Alert,
  TextInput,
  View,
} from "react-native";
import FocusAlert from "focus-alert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ParentModeScreen from "./ParentMode";
import ChildModeScreen from "./ChildMode";
import WelcomeScreen from "./WelcomeScreen";
import DeviceSetupScreen from "./DeviceSetup";
import { doc, setDoc } from "firebase/firestore";

import {
  DEFAULT_QUESTION,
  DEFAULT_OPTIONS,
  createSession,
  CommunicationSession,
  DEFAULT_ROOM_ID,
  db,
  roomExists,
} from "./communicationHelpers";
import { styles } from "./communicationCommon";

type AppState = "loading" | "welcome" | "setup" | "parent" | "child";
type SessionTemplateId = "food" | "feelings" | "activities" | "yesNo";
type savedSessionTemplate = {
  id: string;
  name: string;
  question: string;
  options: string[];
  createdAt: number;
};

const SAVED_TEMPLATES_STORAGE_KEY = "savedSessionTemplates";

const SESSION_TEMPLATES: Record<
  SessionTemplateId,
  {
    question: string;
    options: string[];
  }
> = {
  food: {
    question: "What would you like to eat?",
    options: ["Rice", "Noodles", "Pizza", "Sandwich"],
  },
  feelings: {
    question: "How are you feeling?",
    options: ["Happy", "Sad", "Angry", "Tired"],
  },
  activities: {
    question: "What would you like to do?",
    options: ["Rest", "Play", "Walk", "Read"],
  },
  yesNo: {
    question: "Do you want this?",
    options: ["Yes", "No", "Maybe", "Later"],
  },
};

console.log("App Running");

export default function CommunicationMvpApp() {
  // This component owns the top-level app state and decides which screen to show.
  const [appState, setAppState] = useState<AppState>("loading");
  const [deviceRole, setDeviceRole] = useState<"parent" | "child" | null>(null);
  const [roomId, setRoomId] = useState<string>(DEFAULT_ROOM_ID);
  const [draftQuestion, setDraftQuestion] = useState(DEFAULT_QUESTION);
  const [draftOptions, setDraftOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [showPreview, setShowPreview] = useState(false);
  const [sentSession, setSentSession] = useState<CommunicationSession | null>(
    null,
  );
  const [templateVersion, setTemplateVersion] = useState(0);
  const [savedTemplates, setSavedTemplates] = useState<savedSessionTemplate[]>(
    [],
  );

  // Load persisted setup on app launch
  useEffect(() => {
    const loadSetup = async () => {
      try {
        const savedRole = await AsyncStorage.getItem("deviceRole");
        const savedRoomId = await AsyncStorage.getItem("roomId");

        if (savedRole && savedRoomId) {
          setDeviceRole(savedRole as "parent" | "child");
          setRoomId(savedRoomId);
          setAppState(savedRole === "parent" ? "parent" : "child");
        } else {
          setAppState("welcome");
        }
      } catch (error) {
        console.warn("Failed to load setup from AsyncStorage", error);
        setAppState("welcome");
      }
    };

    loadSetup();
  }, []);
  useEffect(() => {
    const loadSavedTemplates = async () => {
      try {
        const rawTemplates = await AsyncStorage.getItem(
          SAVED_TEMPLATES_STORAGE_KEY,
        );
        if (!rawTemplates) return;

        const parsedTemplates = JSON.parse(rawTemplates);
        if (Array.isArray(parsedTemplates)) {
          setSavedTemplates(parsedTemplates);
        }
      } catch (error) {
        console.warn("Failed to load saved templates from AsyncStorage", error);
      }
    };
    loadSavedTemplates();
  }, []);

  useEffect(() => {
    // Listen for the deep link used by the native focus alert path and switch into child mode.
    const handleUrl = (url: string) => {
      console.log("Deep link received:", url);

      if (url.includes("child-alert")) {
        setDeviceRole("child");
        setAppState("child");
      }
    };

    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleProceedToSetup = () => {
    setAppState("setup");
  };

  const handleSetupComplete = async (
    role: "parent" | "child",
    room: string,
  ) => {
    try {
      console.log("Setup complete with role:", role, "and room:", room);
      await AsyncStorage.setItem("deviceRole", role);
      await AsyncStorage.setItem("roomId", room);

      // If this is a child device, fetch its FCM token and store it in the room document.
      if (role === "child") {
        try {
          console.log("CHILD TOKEN SAVE STARTED");

          const token = await FocusAlert.getFcmToken();

          console.log("TOKEN FROM NATIVE:", token);

          const roomRef = doc(db, "rooms", room);

          await setDoc(
            roomRef,
            {
              childFcmToken: token || "NO_TOKEN_RETURNED_TEST",
              tokenSavedAt: Date.now(),
            },
            { merge: true },
          );

          console.log("FIRESTORE TOKEN WRITE COMPLETE");
        } catch (tokenError) {
          console.warn("Failed to get or save FCM token", tokenError);
        }
      }

      setDeviceRole(role);
      setRoomId(room);
      setAppState(role === "parent" ? "parent" : "child");
    } catch (error) {
      console.warn("Failed to save setup to AsyncStorage", error);
    }
  };

  const handleResetSetup = async () => {
    try {
      await AsyncStorage.removeItem("deviceRole");
      await AsyncStorage.removeItem("roomId");
      setDeviceRole(null);
      setRoomId(DEFAULT_ROOM_ID);
      setAppState("welcome");
      setSentSession(null);
      setDraftQuestion(DEFAULT_QUESTION);
      setDraftOptions(DEFAULT_OPTIONS);
      setShowPreview(false);
      setTemplateVersion((value) => value + 1);
    } catch (error) {
      console.warn("Failed to reset setup", error);
    }
  };

  const handleQuestionChange = (value: string) => setDraftQuestion(value);

  const handleOptionLabelChange = (index: number, value: string) => {
    setDraftOptions((currentOptions) => {
      const nextOptions = [...currentOptions];
      nextOptions[index] = value;
      return nextOptions;
    });
  };

  const handleApplyTemplate = (templateId: SessionTemplateId) => {
    const template = SESSION_TEMPLATES[templateId];

    setDraftQuestion(template.question);
    setDraftOptions(template.options);
    setSentSession(null);
    setShowPreview(true);

    // This tells ParentMode to clear any old image selections from the previous draft.
    setTemplateVersion((value) => value + 1);
  };

  const persistSavedTemplate = async (nextTemplate: savedSessionTemplate[]) => {
    setSavedTemplates(nextTemplate);
    await AsyncStorage.setItem(
      SAVED_TEMPLATES_STORAGE_KEY,
      JSON.stringify(nextTemplate),
    );
  };

  const handleSaveCurrentTemplate = async (templateName?: string) => {
    const cleanedQuestion = draftQuestion.trim() || "Untitled question";
    const cleanedOptions = draftOptions.map((option) => option.trim());

    if (cleanedOptions.every((option) => !option)) {
      Alert.alert(
        "Add options first",
        "Please add at least one option before saving a template.",
      );
      return;
    }

    const cleanedTemplateName = templateName?.trim();

    const fallbackName =
      cleanedQuestion.length > 28
        ? `${cleanedQuestion.slice(0, 28)}...`
        : cleanedQuestion;

    const nextTemplate: savedSessionTemplate = {
      id: String(Date.now()),
      name: cleanedTemplateName || fallbackName,
      question: cleanedQuestion,
      options: cleanedOptions,
      createdAt: Date.now(),
    };

    const nextTemplates = [nextTemplate, ...savedTemplates].slice(0, 10);

    try {
      await persistSavedTemplate(nextTemplates);

      Alert.alert(
        "Template saved",
        "You can reuse this question and options from the Templates tab.",
      );
    } catch (error) {
      console.warn("Failed to save template", error);
      Alert.alert(
        "Could not save template",
        "Something went wrong while saving this template.",
      );
    }
  };

  const handleApplySavedTemplate = async (templateId: string) => {
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setDraftQuestion(template.question);
    setDraftOptions(template.options);
    setSentSession(null);
    setShowPreview(true);
    setTemplateVersion((value) => value + 1);

    const reorderedTemplates = [
      template,
      ...savedTemplates.filter((item) => item.id !== templateId),
    ]
    try{
      await persistSavedTemplate(reorderedTemplates);
    } catch (error) {
      console.warn("Failed to reorder templates", error);
    }
  };

  const handleDeleteSavedTemplate = async (templateId: string) => {
    const nextTemplates = savedTemplates.filter(
      (item) => item.id !== templateId,
    );
    try {
      await persistSavedTemplate(nextTemplates);
    } catch (error) {
      console.warn("Failed to delete template", error);
    }
  };

  const handlePreviewToggle = () => setShowPreview((v) => !v);

  const handleSendToChild = () => {
    // Build a new session draft and keep it in local state until the parent actually sends it.
    const nextSession = createSession(draftQuestion, draftOptions);
    setSentSession(nextSession);
    setShowPreview(false);
  };
  const handleClearSession = () => {
    setSentSession(null);
    setShowPreview(false);
  };

  if (appState === "loading") {
    return <SafeAreaView style={styles.appShell} />;
  }

  if (appState === "welcome") {
    return (
      <SafeAreaView style={styles.appShell}>
        <WelcomeScreen onGetStarted={handleProceedToSetup} />
      </SafeAreaView>
    );
  }

  if (appState === "setup") {
    return (
      <SafeAreaView style={styles.appShell}>
        <DeviceSetupScreen onSetupComplete={handleSetupComplete} />
      </SafeAreaView>
    );
  }

  if (appState === "parent" && deviceRole === "parent") {
    return (
      <SafeAreaView style={styles.appShell}>
        <ParentModeScreen
          question={draftQuestion}
          optionLabels={draftOptions}
          sentSession={sentSession}
          showPreview={showPreview}
          roomId={roomId}
          templateVersion={templateVersion}
          savedTemplates={savedTemplates}
          onQuestionChange={handleQuestionChange}
          onOptionLabelChange={handleOptionLabelChange}
          onApplyTemplate={handleApplyTemplate}
          onSaveCurrentTemplate={handleSaveCurrentTemplate}
          onApplySavedTemplate={handleApplySavedTemplate}
          onDeleteSavedTemplate={handleDeleteSavedTemplate}
          onPreviewToggle={handlePreviewToggle}
          onSendToChild={handleSendToChild}
          onResetSetup={handleResetSetup}
          onClearSession={handleClearSession}
        />
      </SafeAreaView>
    );
  }

  if (appState === "child" && deviceRole === "child") {
    return (
      <SafeAreaView style={styles.appShell}>
        <ChildModeScreen roomId={roomId} onResetSetup={handleResetSetup} />
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.appShell} />;
}

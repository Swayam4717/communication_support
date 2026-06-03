import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  Linking,
  Alert,
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
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
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
      await AsyncStorage.setItem("deviceRole", role);
      await AsyncStorage.setItem("roomId", room);

      // If this is a child device, fetch its FCM token and store it in the room document.
      if (role === "child") {
        try {
          const token = await FocusAlert.getFcmToken();

          const roomRef = doc(db, "rooms", room);

          if (!token) {
            await setDoc(
              roomRef,
              {
                childFcmToken: null,
                tokenSavedAt: Date.now(),
              },
              { merge: true },
            );

            Alert.alert(
              "Attention alerts may not work",
              "This child device could not get an alert token. The child can still answer in the app, but overlay alerts may not appear.",
            );
          } else {
            await setDoc(
              roomRef,
              {
                childFcmToken: token,
                tokenSavedAt: Date.now(),
              },
              { merge: true },
            );
          }
        } catch (tokenError) {
          console.warn("Failed to get or save FCM token", tokenError);
          Alert.alert(
            "Attention alerts may not work",
            "This child device could not finish alert setup. The child can still answer in the app, but overlay alerts may not appear.",
          );
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
      setEditingTemplateId(null);
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
    setShowPreview(false);
    setEditingTemplateId(null);

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
      return false;
    }

    const cleanedTemplateName = templateName?.trim();

    const fallbackName =
      cleanedQuestion.length > 28
        ? `${cleanedQuestion.slice(0, 28)}...`
        : cleanedQuestion;

    const finalTemplateName = cleanedTemplateName || fallbackName;

    const editingTemplate = editingTemplateId
      ? savedTemplates.find((template) => template.id === editingTemplateId)
      : null;

    const existingTemplate = savedTemplates.find(
      (template) =>
        template.id !== editingTemplateId &&
        template.name.trim().toLowerCase() ===
        finalTemplateName.trim().toLowerCase(),
    );

    if (editingTemplate && existingTemplate) {
      Alert.alert(
        "Template name already exists",
        "Please choose a different name before updating this template.",
      );
      return false;
    }

    const nextTemplate: savedSessionTemplate = {
      id: editingTemplate?.id ?? existingTemplate?.id ?? String(Date.now()),
      name: finalTemplateName,
      question: cleanedQuestion,
      options: cleanedOptions,
      createdAt:
        editingTemplate?.createdAt ?? existingTemplate?.createdAt ?? Date.now(),
    };

    const nextTemplates = [
      nextTemplate,
      ...savedTemplates.filter((template) => template.id !== nextTemplate.id),
    ].slice(0, 10);
    try {
      await persistSavedTemplate(nextTemplates);
      setEditingTemplateId(null);

      Alert.alert(
        editingTemplate || existingTemplate
          ? "Template updated"
          : "Template saved",
        editingTemplate || existingTemplate
          ? "The existing template has been updated and moved to the top"
          : "You can reuse this question and options from the Templates tab.",
      );
      return true;
    } catch (error) {
      console.warn("Failed to save template", error);
      Alert.alert(
        "Could not save template",
        "Something went wrong while saving this template.",
      );
      return false;
    }
  };

  const handleApplySavedTemplate = async (templateId: string) => {
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setDraftQuestion(template.question);
    setDraftOptions(template.options);
    setSentSession(null);
    setShowPreview(false);
    setEditingTemplateId(null);
    setTemplateVersion((value) => value + 1);

    const reorderedTemplates = [
      template,
      ...savedTemplates.filter((item) => item.id !== templateId),
    ];
    try {
      await persistSavedTemplate(reorderedTemplates);
    } catch (error) {
      console.warn("Failed to reorder templates", error);
    }
  };

  const handleEditSavedTemplate = (templateId: string) => {
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) return;

    setDraftQuestion(template.question);
    setDraftOptions(template.options);
    setSentSession(null);
    setShowPreview(false);
    setEditingTemplateId(template.id);
    setTemplateVersion((value) => value + 1);
  };

  const handleCancelTemplateEdit = () => {
    setEditingTemplateId(null);
  };

  const handleDeleteSavedTemplate = async (templateId: string) => {
    const nextTemplates = savedTemplates.filter(
      (item) => item.id !== templateId,
    );
    try {
      await persistSavedTemplate(nextTemplates);
      if (editingTemplateId === templateId) {
        setEditingTemplateId(null);
      }
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
          editingTemplateName={
            savedTemplates.find((template) => template.id === editingTemplateId)
              ?.name ?? null
          }
          onQuestionChange={handleQuestionChange}
          onOptionLabelChange={handleOptionLabelChange}
          onApplyTemplate={handleApplyTemplate}
          onSaveCurrentTemplate={handleSaveCurrentTemplate}
          onApplySavedTemplate={handleApplySavedTemplate}
          onEditSavedTemplate={handleEditSavedTemplate}
          onCancelTemplateEdit={handleCancelTemplateEdit}
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

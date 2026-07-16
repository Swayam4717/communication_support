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
  SessionOption,
  DEFAULT_ROOM_ID,
  DEFAULT_SPEECH_TEMPLATE,
  DEFAULT_SPEECH_ASSISTANT_ENABLED,
  DEFAULT_VISUAL_ONLY_MODE,
  db,
} from "./communicationHelpers";
import { styles } from "./communicationCommon";

type AppState = "loading" | "welcome" | "setup" | "parent" | "child";
type SessionTemplateId = "food" | "feelings" | "activities" | "yesNo";
type savedSessionTemplate = {
  id: string;
  name: string;
  question: string;
  options: string[];
  optionDetails?: SessionOption[];
  speechTemplate?: string;
  visualOnlyMode?: boolean;
  speechAssistantEnabled?: boolean;
  createdAt: number;
};

const SAVED_TEMPLATES_STORAGE_KEY = "savedSessionTemplates";

const SESSION_TEMPLATES: Record<
  SessionTemplateId,
  {
    question: string;
    options: string[];
    speechTemplate: string;
  }
> = {
  food: {
    question: "What would you like to eat?",
    options: ["Rice", "Noodles", "Pizza", "Sandwich"],
    speechTemplate: "I want {option}",
  },
  feelings: {
    question: "How are you feeling?",
    options: ["Happy", "Sad", "Angry", "Tired"],
    speechTemplate: "I feel {option}",
  },
  activities: {
    question: "What would you like to do?",
    options: ["Rest", "Play", "Walk", "Read"],
    speechTemplate: "I want {option}",
  },
  yesNo: {
    question: "Do you want this?",
    options: ["Yes", "No", "Maybe", "Later"],
    speechTemplate: "{option}",
  },
};


export default function CommunicationMvpApp() {
  // This component owns the top-level app state and decides which screen to show.
  const [appState, setAppState] = useState<AppState>("loading");
  const [deviceRole, setDeviceRole] = useState<"parent" | "child" | null>(null);
  const [roomId, setRoomId] = useState<string>(DEFAULT_ROOM_ID);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [draftOptions, setDraftOptions] = useState<string[]>([""]);
  const [draftOptionDetails, setDraftOptionDetails] = useState<
    SessionOption[] | null
  >(null);
  const [draftSpeechTemplate, setDraftSpeechTemplate] = useState(
    DEFAULT_SPEECH_TEMPLATE,
  );
  const [draftVisualOnlyMode, setDraftVisualOnlyMode] = useState(
    DEFAULT_VISUAL_ONLY_MODE,
  );
  const [draftSpeechAssistantEnabled, setDraftSpeechAssistantEnabled] = useState(
    DEFAULT_SPEECH_ASSISTANT_ENABLED,
  );
  const [templateVersion, setTemplateVersion] = useState(0);
  const [savedTemplates, setSavedTemplates] = useState<savedSessionTemplate[]>(
    [],
  );
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [openChildSessionDirectly, setOpenChildSessionDirectly] =
    useState(false);

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
    const handleUrl = async (url: string) => {
      console.log("Deep link received:", url);

      if (url.includes("child-alert")) {
        const savedRole = await AsyncStorage.getItem("deviceRole");
        const savedRoomId = await AsyncStorage.getItem("roomId");

        if (savedRole !== "child" || !savedRoomId) {
          setAppState("setup");
          return;
        }

        setDeviceRole("child");
        setRoomId(savedRoomId);
        setOpenChildSessionDirectly(true);
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
      setDraftQuestion("");
      setDraftOptions([""]);
      setDraftOptionDetails(null);
      setDraftSpeechTemplate(DEFAULT_SPEECH_TEMPLATE);
      setDraftVisualOnlyMode(DEFAULT_VISUAL_ONLY_MODE);
      setDraftSpeechAssistantEnabled(DEFAULT_SPEECH_ASSISTANT_ENABLED);
      setEditingTemplateId(null);
      setTemplateVersion((value) => value + 1);
    } catch (error) {
      console.warn("Failed to reset setup", error);
    }
  };

  const handleQuestionChange = (value: string) => setDraftQuestion(value);
  const handleSpeechTemplateChange = (value: string) =>
    setDraftSpeechTemplate(value);
  const handleVisualOnlyModeChange = (value: boolean) =>
    setDraftVisualOnlyMode(value);
  const handleSpeechAssistantEnabledChange = (value: boolean) =>
    setDraftSpeechAssistantEnabled(value);

  const resetParentDraft = () => {
    setDraftQuestion("");
    setDraftOptions([""]);
    setDraftOptionDetails(null);
    setDraftSpeechTemplate(DEFAULT_SPEECH_TEMPLATE);
    setDraftVisualOnlyMode(DEFAULT_VISUAL_ONLY_MODE);
    setDraftSpeechAssistantEnabled(DEFAULT_SPEECH_ASSISTANT_ENABLED);
    setEditingTemplateId(null);
    setTemplateVersion((value) => value + 1);
  };

  const handleOptionLabelChange = (index: number, value: string) => {
    setDraftOptions((currentOptions) => {
      const nextOptions = [...currentOptions];
      nextOptions[index] = value;
      return nextOptions;
    });
    setDraftOptionDetails(null);
  };

  const handleOptionLabelsReplace = (values: string[]) => {
    setDraftOptions(values.length > 0 ? values : [""]);
    setDraftOptionDetails(null);
  };

  const handleAddOption = () => {
    setDraftOptions((currentOptions) => [...currentOptions, ""]);
    setDraftOptionDetails(null);
  };

  const handleRemoveOption = (index: number) => {
    setDraftOptions((currentOptions) => {
      if (currentOptions.length <= 1) {
        return currentOptions;
      }

      return currentOptions.filter((_, optionIndex) => optionIndex !== index);
    });
    setDraftOptionDetails(null);
  };

  const handleApplyTemplate = (templateId: SessionTemplateId) => {
    const template = SESSION_TEMPLATES[templateId];

    setDraftQuestion(template.question);
    setDraftOptions(template.options);
    setDraftOptionDetails(null);
    setDraftSpeechTemplate(template.speechTemplate);
    setDraftVisualOnlyMode(DEFAULT_VISUAL_ONLY_MODE);
    setDraftSpeechAssistantEnabled(DEFAULT_SPEECH_ASSISTANT_ENABLED);
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

  const saveTemplateFromValues = async ({
    question,
    options,
    optionDetails,
    speechTemplate,
    visualOnlyMode,
    speechAssistantEnabled,
    templateName,
    editingTemplateIdToUse,
    showSuccessAlert,
  }: {
    question: string;
    options: string[];
    optionDetails?: SessionOption[] | null;
    speechTemplate?: string;
    visualOnlyMode?: boolean;
    speechAssistantEnabled?: boolean;
    templateName?: string;
    editingTemplateIdToUse?: string | null;
    showSuccessAlert: boolean;
  }) => {
    const cleanedQuestion = question.trim() || "Untitled question";
    const cleanedOptions = options
      .map((option) => option.trim())
      .filter(Boolean);
    const cleanedSpeechTemplate =
      speechTemplate?.trim() || DEFAULT_SPEECH_TEMPLATE;

    if (cleanedOptions.length < 2) {
      Alert.alert(
        "Check answer options",
        "Please keep at least two options before saving.",
      );
      return false;
    }

    const cleanedTemplateName = templateName?.trim();

    const fallbackName =
      cleanedQuestion.length > 28
        ? `${cleanedQuestion.slice(0, 28)}...`
        : cleanedQuestion;

    const finalTemplateName = cleanedTemplateName || fallbackName;

    const editingTemplate = editingTemplateIdToUse
      ? savedTemplates.find((template) => template.id === editingTemplateIdToUse)
      : null;

    const existingTemplate = savedTemplates.find(
      (template) =>
        template.id !== editingTemplateIdToUse &&
        template.name.trim().toLowerCase() ===
        finalTemplateName.trim().toLowerCase(),
    );

    if (editingTemplate && existingTemplate) {
      Alert.alert(
        "Name already exists",
        "Please choose a different name before updating this saved item.",
      );
      return false;
    }

    const nextTemplate: savedSessionTemplate = {
      id: editingTemplate?.id ?? existingTemplate?.id ?? String(Date.now()),
      name: finalTemplateName,
      question: cleanedQuestion,
      options: cleanedOptions,
      ...(optionDetails?.length
        ? {
            optionDetails: optionDetails.map((option, index) => ({
              ...option,
              id: String(index + 1),
            })),
          }
        : {}),
      speechTemplate: cleanedSpeechTemplate,
      visualOnlyMode: visualOnlyMode ?? DEFAULT_VISUAL_ONLY_MODE,
      speechAssistantEnabled:
        speechAssistantEnabled ?? DEFAULT_SPEECH_ASSISTANT_ENABLED,
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

      if (showSuccessAlert) {
        Alert.alert(
          editingTemplate || existingTemplate
            ? "Saved item updated"
            : "Saved for future use",
          editingTemplate || existingTemplate
            ? "The existing saved item has been updated and moved to the top"
            : "You can reuse this question and options from the Saved tab.",
        );
      }
      return true;
    } catch (error) {
      console.warn("Failed to save template", error);
      Alert.alert(
        "Could not save",
        "Something went wrong while saving this item.",
      );
      return false;
    }
  };

  const handleSaveCurrentTemplate = async (
    templateName?: string,
    optionDetails?: SessionOption[] | null,
  ) =>
    saveTemplateFromValues({
      question: draftQuestion,
      options: draftOptions,
      optionDetails,
      speechTemplate: draftSpeechTemplate,
      visualOnlyMode: draftVisualOnlyMode,
      speechAssistantEnabled: draftSpeechAssistantEnabled,
      templateName,
      editingTemplateIdToUse: editingTemplateId,
      showSuccessAlert: true,
    });

  const handleSaveHistoryTemplate = async (
    historyQuestion: string,
    historyOptions: string[],
    historyOptionDetails?: SessionOption[] | null,
    historySpeechTemplate?: string | null,
    historyVisualOnlyMode?: boolean | null,
    historySpeechAssistantEnabled?: boolean | null,
  ) =>
    saveTemplateFromValues({
      question: historyQuestion,
      options: historyOptions,
      optionDetails: historyOptionDetails,
      speechTemplate: historySpeechTemplate ?? draftSpeechTemplate,
      visualOnlyMode: historyVisualOnlyMode ?? DEFAULT_VISUAL_ONLY_MODE,
      speechAssistantEnabled:
        historySpeechAssistantEnabled ?? DEFAULT_SPEECH_ASSISTANT_ENABLED,
      editingTemplateIdToUse: null,
      showSuccessAlert: false,
    });

  const handleApplySavedTemplate = async (templateId: string) => {
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setDraftQuestion(template.question);
    setDraftOptions(template.options);
    setDraftOptionDetails(template.optionDetails ?? null);
    setDraftSpeechTemplate(template.speechTemplate ?? DEFAULT_SPEECH_TEMPLATE);
    setDraftVisualOnlyMode(template.visualOnlyMode ?? DEFAULT_VISUAL_ONLY_MODE);
    setDraftSpeechAssistantEnabled(
      template.speechAssistantEnabled ?? DEFAULT_SPEECH_ASSISTANT_ENABLED,
    );
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
    setDraftOptionDetails(template.optionDetails ?? null);
    setDraftSpeechTemplate(template.speechTemplate ?? DEFAULT_SPEECH_TEMPLATE);
    setDraftVisualOnlyMode(template.visualOnlyMode ?? DEFAULT_VISUAL_ONLY_MODE);
    setDraftSpeechAssistantEnabled(
      template.speechAssistantEnabled ?? DEFAULT_SPEECH_ASSISTANT_ENABLED,
    );
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

  const handleClearSession = () => {
    resetParentDraft();
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
          speechTemplate={draftSpeechTemplate}
          initialOptionDetails={draftOptionDetails}
          visualOnlyMode={draftVisualOnlyMode}
          speechAssistantEnabled={draftSpeechAssistantEnabled}
          roomId={roomId}
          templateVersion={templateVersion}
          savedTemplates={savedTemplates}
          editingTemplateName={
            savedTemplates.find((template) => template.id === editingTemplateId)
              ?.name ?? null
          }
          onQuestionChange={handleQuestionChange}
          onOptionLabelChange={handleOptionLabelChange}
          onOptionLabelsReplace={handleOptionLabelsReplace}
          onAddOption={handleAddOption}
          onRemoveOption={handleRemoveOption}
          onSpeechTemplateChange={handleSpeechTemplateChange}
          onVisualOnlyModeChange={handleVisualOnlyModeChange}
          onSpeechAssistantEnabledChange={handleSpeechAssistantEnabledChange}
          onApplyTemplate={handleApplyTemplate}
          onSaveCurrentTemplate={handleSaveCurrentTemplate}
          onApplySavedTemplate={handleApplySavedTemplate}
          onEditSavedTemplate={handleEditSavedTemplate}
          onCancelTemplateEdit={handleCancelTemplateEdit}
          onDeleteSavedTemplate={handleDeleteSavedTemplate}
          onSaveHistoryTemplate={handleSaveHistoryTemplate}
          onResetSetup={handleResetSetup}
          onClearSession={handleClearSession}
        />
      </SafeAreaView>
    );
  }

  if (appState === "child" && deviceRole === "child") {
    return (
      <SafeAreaView style={styles.appShell}>
        <ChildModeScreen
          roomId={roomId}
          openActiveSessionDirectly={openChildSessionDirectly}
          onOpenActiveSessionHandled={() => setOpenChildSessionDirectly(false)}
          onResetSetup={handleResetSetup}
        />
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.appShell} />;
}

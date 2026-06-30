import React, { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type {
  CommunicationSession,
  SessionHistoryItem,
  SessionOption,
} from "./communicationHelpers";
import {
  createSession,
  createSessionWithResolvedOptions,
  DEFAULT_SPEECH_TEMPLATE,
  getSpeechPracticePhrase,
  parseOptionLabelForVisual,
  resetSession,
  sendSession,
  subscribeToSession,
  uploadOptionImage,
  generateOptionVisualsFromCloud,
  getCurrentSession,
  saveSessionHistory,
  subscribeToSessionHistory,
} from "./communicationHelpers";
import { OptionCard } from "./communicationUI";
import { styles } from "./communicationCommon";

type sessionTemplateId = "food" | "feelings" | "activities" | "yesNo";
type savedSessionTemplate = {
  id: string;
  name: string;
  question: string;
  options: string[];
  speechTemplate?: string;
  createdAt: number;
};

const MIN_REUSABLE_HISTORY_OPTIONS = 2;
const MAX_REUSABLE_HISTORY_OPTIONS = 12;
const MAX_REUSABLE_HISTORY_LABEL_LENGTH = 60;
const MAX_REUSABLE_HISTORY_META_LENGTH = 80;
const MAX_REUSABLE_HISTORY_IMAGE_URL_LENGTH = 2048;

interface ParentModeScreenProps {
  question: string;
  optionLabels: string[];
  speechTemplate: string;
  sentSession: CommunicationSession | null;
  showPreview: boolean;
  roomId: string;
  templateVersion: number;
  savedTemplates: savedSessionTemplate[];
  editingTemplateName: string | null;
  onQuestionChange: (value: string) => void;
  onOptionLabelChange: (index: number, value: string) => void;
  onOptionLabelsReplace: (values: string[]) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onSpeechTemplateChange: (value: string) => void;
  onPreviewToggle: () => void;
  onSendToChild: () => void;
  onResetSetup: () => void;
  onApplyTemplate: (templateId: sessionTemplateId) => void;
  onApplySavedTemplate: (templateId: string) => void;
  onEditSavedTemplate: (templateId: string) => void;
  onCancelTemplateEdit: () => void;
  onSaveCurrentTemplate: (templateName?: string) => Promise<boolean>;
  onSaveHistoryTemplate: (
    question: string,
    options: string[],
    speechTemplate?: string | null,
  ) => Promise<boolean>;
  onDeleteSavedTemplate: (templateId: string) => void;
  onClearSession: () => void;
}

const getOrdinalSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return "th";

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

const formatHistoryTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const isSameDay = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();

  const hours = date.getHours();
  const displayHours = hours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "pm" : "am";
  const time = `${displayHours}:${minutes} ${period}`;

  if (isSameDay(date, now)) {
    return `Today, ${time}`;
  }

  if (isSameDay(date, yesterday)) {
    return `Yesterday, ${time}`;
  }

  const day = date.getDate();
  const month = monthNames[date.getMonth()];

  return `${day}${getOrdinalSuffix(day)} ${month}, ${time}`;
};

const getSafeHistoryActionText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const getSafeHistoryActionImageUrl = (value: unknown) => {
  const imageUrl = getSafeHistoryActionText(
    value,
    MAX_REUSABLE_HISTORY_IMAGE_URL_LENGTH,
  );

  return /^https?:\/\//i.test(imageUrl) ? imageUrl : "";
};

const getReusableHistoryOptions = (item: SessionHistoryItem) => {
  if (!Array.isArray(item.options)) {
    return [];
  }

  return item.options
    .slice(0, MAX_REUSABLE_HISTORY_OPTIONS)
    .reduce<SessionOption[]>((safeOptions, option, index) => {
      const label = getSafeHistoryActionText(
        option?.label,
        MAX_REUSABLE_HISTORY_LABEL_LENGTH,
      );

      if (!label) {
        return safeOptions;
      }

      const emoji = getSafeHistoryActionText(
        option?.emoji,
        MAX_REUSABLE_HISTORY_META_LENGTH,
      );
      const imageUrl = getSafeHistoryActionImageUrl(option?.imageUrl);
      const visualKeyword = getSafeHistoryActionText(
        option?.visualKeyword,
        MAX_REUSABLE_HISTORY_LABEL_LENGTH,
      );
      const source = getSafeHistoryActionText(
        option?.source,
        MAX_REUSABLE_HISTORY_META_LENGTH,
      );
      const provider = getSafeHistoryActionText(
        option?.provider,
        MAX_REUSABLE_HISTORY_META_LENGTH,
      );

      safeOptions.push({
        id:
          getSafeHistoryActionText(
            option?.id,
            MAX_REUSABLE_HISTORY_META_LENGTH,
          ) || String(index + 1),
        label,
        ...(visualKeyword ? { visualKeyword } : {}),
        ...(emoji ? { emoji } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(source ? { source } : {}),
        ...(provider ? { provider } : {}),
      });

      return safeOptions;
    }, []);
};

const getDisplaySpeechTemplate = (speechTemplate?: string | null) =>
  speechTemplate?.trim() || "";

const getHistorySpeechPracticeText = (item: SessionHistoryItem) => {
  const speechTemplate = getDisplaySpeechTemplate(item.speechTemplate);

  if (!speechTemplate || !item.answer?.trim()) {
    return "";
  }

  return getSpeechPracticePhrase(item.answer, speechTemplate);
};

export default function ParentModeScreen({
  question,
  optionLabels,
  speechTemplate,
  sentSession,
  showPreview,
  roomId,
  templateVersion,
  savedTemplates,
  editingTemplateName,
  onQuestionChange,
  onOptionLabelChange,
  onOptionLabelsReplace,
  onAddOption,
  onRemoveOption,
  onSpeechTemplateChange,
  onPreviewToggle,
  onSendToChild,
  onResetSetup,
  onApplyTemplate,
  onApplySavedTemplate,
  onEditSavedTemplate,
  onCancelTemplateEdit,
  onSaveCurrentTemplate,
  onSaveHistoryTemplate,
  onDeleteSavedTemplate,
  onClearSession,
}: ParentModeScreenProps) {
  const [fireSession, setFireSession] =
    React.useState<CommunicationSession | null>(null);

  const [sessionHistory, setSessionHistory] = React.useState<
    SessionHistoryItem[]
  >([]);

  const [savedHistorySessionId, setSavedHistorySessionId] = React.useState<
    string | null
  >(null);

  const [optionImageUrls, setOptionImageUrls] = useState<string[]>(
    optionLabels.map(() => ""),
  );

  const [resolvedOptions, setResolvedOptions] = useState<
    SessionOption[] | null
  >(null);

  const [removedVisualIndexes, setRemovedVisualIndexes] = useState<Set<number>>(
    new Set(),
  );

  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(
    null,
  );

  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const isGeneratingVisualsRef = useRef(false);
  const [activeParentTab, setActiveParentTab] = useState<
    "create" | "history" | "templates"
  >("create");

  const [isSavedTemplateModalVisible, setIsSavedTemplateModalVisible] =
    useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [templateNoticeVisible, setTemplateNoticeVisible] = useState(false);
  const [historyNoticeMessage, setHistoryNoticeMessage] = useState("");
  const [sendNoticeMessage, setSendNoticeMessage] = useState("");
  const templateNoticeTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const historyReuseNoticeTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const sendNoticeTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const isEditingTemplate = !!editingTemplateName;

  React.useEffect(() => {
    return () => {
      if (templateNoticeTimeoutRef.current) {
        clearTimeout(templateNoticeTimeoutRef.current);
      }
      if (historyReuseNoticeTimeoutRef.current) {
        clearTimeout(historyReuseNoticeTimeoutRef.current);
      }
      if (sendNoticeTimeoutRef.current) {
        clearTimeout(sendNoticeTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const unsub = subscribeToSession((s) => setFireSession(s), roomId);
    return () => unsub();
  }, [roomId]);

  React.useEffect(() => {
    const unsub = subscribeToSessionHistory(setSessionHistory, roomId);
    return () => unsub();
  }, [roomId]);

  React.useEffect(() => {
    setOptionImageUrls((currentUrls) =>
      optionLabels.map((_, index) => currentUrls[index] ?? ""),
    );
    setResolvedOptions(null);
    setRemovedVisualIndexes(new Set());
  }, [optionLabels]);

  React.useEffect(() => {
    setOptionImageUrls(optionLabels.map(() => ""));
    setResolvedOptions(null);
    setRemovedVisualIndexes(new Set());
  }, [templateVersion, optionLabels]);

  const applyRemovedVisuals = (
    session: CommunicationSession,
  ): CommunicationSession => {
    if (removedVisualIndexes.size === 0) {
      return session;
    }

    return {
      ...session,
      options: session.options.map((option, index) =>
        removedVisualIndexes.has(index)
          ? {
              ...option,
              imageUrl: null,
              emoji: null,
              source: "none",
              provider: "manual",
            }
          : option,
      ),
    };
  };

  const buildDraftSession = () => {
    const cleanedOptionLabels = optionLabels.map((label) => label.trim());
    const baseSession = resolvedOptions
      ? createSessionWithResolvedOptions(
          question,
          resolvedOptions.map((option, index) => ({
            ...option,
            id: String(index + 1),
            label:
              parseOptionLabelForVisual(cleanedOptionLabels[index] || option.label)
                .displayLabel || option.label,
            visualKeyword:
              parseOptionLabelForVisual(cleanedOptionLabels[index] || option.label)
                .visualKeyword ||
              option.visualKeyword ||
              option.label,
          })),
          speechTemplate,
        )
      : createSession(
          question,
          cleanedOptionLabels,
          optionImageUrls,
          speechTemplate,
        );

    return applyRemovedVisuals(baseSession);
  };

  const draftSession = buildDraftSession();
  const currentSession = fireSession ?? sentSession ?? draftSession;
  const previewSession = draftSession;

  const selectedAnswer =
    currentSession && fireSession?.selectedAnswer
      ? (currentSession.options.find(
          (o) => o.id === fireSession.selectedAnswer,
        ) ?? null)
      : null;

  React.useEffect(() => {
    if (
      fireSession?.status === "answered" &&
      fireSession.selectedAnswer &&
      fireSession.id &&
      savedHistorySessionId !== fireSession.id
    ) {
      saveSessionHistory(fireSession, roomId)
        .then(() => setSavedHistorySessionId(fireSession.id))
        .catch((error) => {
          console.warn("Failed to save session history", error);
        });
    }
  }, [fireSession, roomId, savedHistorySessionId]);

  const areAttentionAlertsReady = !!fireSession?.childFcmToken;

  const setOptionImageUrl = (index: number, imageUrl: string) => {
    setResolvedOptions(null);

    setRemovedVisualIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      nextIndexes.delete(index);
      return nextIndexes;
    });

    setOptionImageUrls((currentUrls) => {
      const nextUrls = [...currentUrls];
      nextUrls[index] = imageUrl;
      return nextUrls;
    });
  };

  const uploadPickedAsset = async (
    index: number,
    asset: ImagePicker.ImagePickerAsset,
  ) => {
    setUploadingImageIndex(index);

    const downloadUrl = await uploadOptionImage(
      asset.uri,
      roomId,
      index,
      asset.mimeType,
    );

    setOptionImageUrl(index, downloadUrl);
  };

  const handleChooseFromGallery = async (index: number) => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo access so you can choose an image from your gallery.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.75,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      await uploadPickedAsset(index, result.assets[0]);
    } catch (error) {
      console.warn("Gallery image upload failed", error);
      Alert.alert(
        "Image upload failed",
        "The gallery image could not be uploaded. Please try again.",
      );
    } finally {
      setUploadingImageIndex(null);
    }
  };

  const handleTakePhoto = async (index: number) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow camera access so you can take a photo for this option.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.75,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      await uploadPickedAsset(index, result.assets[0]);
    } catch (error) {
      console.warn("Camera image upload failed", error);
      Alert.alert(
        "Image upload failed",
        "The camera photo could not be uploaded. Please try again.",
      );
    } finally {
      setUploadingImageIndex(null);
    }
  };
  const openSaveTemplateModal = () => {
    const cleanedLabels = optionLabels.map((label) => label.trim());

    if (cleanedLabels.length < 2 || cleanedLabels.some((label) => !label)) {
      Alert.alert(
        "Check answer options",
        "Please keep at least two options and fill in every option before saving a template.",
      );
      return;
    }

    const cleanedQuestion = question.trim();
    const defaultName =
      editingTemplateName ??
      (cleanedQuestion.length > 28
        ? `${cleanedQuestion.slice(0, 28)}...`
        : cleanedQuestion);
    setTemplateNameInput(defaultName);
    setIsSavedTemplateModalVisible(true);
  };
  const handleConfirmSaveTemplate = async () => {
    const saved = await onSaveCurrentTemplate(templateNameInput);
    if (!saved) {
      return;
    }

    setIsSavedTemplateModalVisible(false);
    setTemplateNameInput("");
  };
  const handleCancelSaveTemplate = () => {
    setIsSavedTemplateModalVisible(false);
    setTemplateNameInput("");
  };

  const showTemplateAddedNotice = () => {
    if (templateNoticeTimeoutRef.current) {
      clearTimeout(templateNoticeTimeoutRef.current);
    }

    setTemplateNoticeVisible(true);
    templateNoticeTimeoutRef.current = setTimeout(() => {
      setTemplateNoticeVisible(false);
    }, 2200);
  };

  const showHistoryNotice = (message: string) => {
    if (historyReuseNoticeTimeoutRef.current) {
      clearTimeout(historyReuseNoticeTimeoutRef.current);
    }

    setHistoryNoticeMessage(message);
    historyReuseNoticeTimeoutRef.current = setTimeout(() => {
      setHistoryNoticeMessage("");
    }, 2600);
  };

  const applyBuiltInTemplate = (templateId: sessionTemplateId) => {
    onApplyTemplate(templateId);
    showTemplateAddedNotice();
  };

  const applySavedTemplate = (templateId: string) => {
    onApplySavedTemplate(templateId);
    showTemplateAddedNotice();
  };

  const handleUseHistoryItem = (item: SessionHistoryItem) => {
    const historyOptions = getReusableHistoryOptions(item);

    if (historyOptions.length < MIN_REUSABLE_HISTORY_OPTIONS) {
      showHistoryNotice(
        "This older history item cannot be reused because its full options were not saved.",
      );
      return;
    }

    if (isEditingTemplate) {
      onCancelTemplateEdit();
    }

    onQuestionChange(item.question);
    if (item.speechTemplate) {
      onSpeechTemplateChange(item.speechTemplate);
    }
    onOptionLabelsReplace(historyOptions.map((option) => option.label));
    setResolvedOptions(historyOptions);
    setRemovedVisualIndexes(new Set());
    setOptionImageUrls(
      historyOptions.map((option) => option.imageUrl ?? ""),
    );
    setActiveParentTab("create");
    showHistoryNotice("Loaded from history. You can edit before sending.");
  };

  const handleSaveHistoryTemplate = async (item: SessionHistoryItem) => {
    const historyOptions = getReusableHistoryOptions(item);

    if (historyOptions.length < MIN_REUSABLE_HISTORY_OPTIONS) {
      showHistoryNotice(
        "This older history item cannot be saved as a template because its full options were not saved.",
      );
      return;
    }

    const saved = await onSaveHistoryTemplate(
      item.question,
      historyOptions.map((option) => option.label),
      item.speechTemplate,
    );

    if (saved) {
      showHistoryNotice("Saved as template.");
    }
  };

  const handleRemoveVisual = (index: number) => {
    setRemovedVisualIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      nextIndexes.add(index);
      return nextIndexes;
    });

    setOptionImageUrls((currentUrls) => {
      const nextUrls = [...currentUrls];
      nextUrls[index] = "";
      return nextUrls;
    });

    setResolvedOptions((currentOptions) =>
      currentOptions
        ? currentOptions.map((option, optionIndex) =>
            optionIndex === index
              ? {
                  ...option,
                  imageUrl: null,
                  emoji: null,
                  source: "none",
                  provider: "manual",
                }
              : option,
          )
        : currentOptions,
    );
  };

  const handleAddOption = () => {
    setResolvedOptions(null);
    setRemovedVisualIndexes(new Set());
    setOptionImageUrls((currentUrls) => [...currentUrls, ""]);
    onAddOption();
  };

  const handleRemoveOption = (index: number) => {
    if (optionLabels.length <= 2) {
      showMessage(
        "Keep two options",
        "Please keep at least two answer options.",
      );
      return;
    }

    setResolvedOptions((currentOptions) =>
      currentOptions
        ? currentOptions.filter((_, optionIndex) => optionIndex !== index)
        : currentOptions,
    );
    setOptionImageUrls((currentUrls) =>
      currentUrls.filter((_, optionIndex) => optionIndex !== index),
    );
    setRemovedVisualIndexes((currentIndexes) => {
      const nextIndexes = new Set<number>();
      currentIndexes.forEach((optionIndex) => {
        if (optionIndex < index) {
          nextIndexes.add(optionIndex);
        } else if (optionIndex > index) {
          nextIndexes.add(optionIndex - 1);
        }
      });
      return nextIndexes;
    });
    onRemoveOption(index);
  };

  const isUploadingImage = uploadingImageIndex !== null;
  const isImageWorkInProgress = isUploadingImage || isGeneratingVisuals;
  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const handleGenerateVisuals = async () => {
    if (isImageWorkInProgress || isGeneratingVisualsRef.current) {
      if (isGeneratingVisualsRef.current) {
        showMessage(
          "Visuals are still loading",
          "Please wait for the current visuals to finish before trying again.",
        );
      }
      return;
    }
    const cleanedLabels = optionLabels
      .map((label) => label.trim())
      .filter(Boolean);
    if (cleanedLabels.length < 2) {
      showMessage(
        "Add options first",
        "Please enter at least two options before generating visuals.",
      );
      return;
    }

    if (cleanedLabels.length !== optionLabels.length) {
      showMessage(
        "Fill or remove blank options",
        "Please fill in every option label, or remove blank option rows, before generating visuals.",
      );
      return;
    }

    const tooLongLabel = cleanedLabels.find((label) => label.length > 60);
    if (tooLongLabel) {
      showMessage(
        "Option too long",
        "Please keep each option under 60 characters for clear visuals.",
      );
      return;
    }
    isGeneratingVisualsRef.current = true;
    setIsGeneratingVisuals(true);

    try {
      const generatedOptions = await generateOptionVisualsFromCloud(
        question,
        cleanedLabels,
      );
      const textOptions = createSession(
        question,
        cleanedLabels,
        optionImageUrls,
        speechTemplate,
      ).options;
      const mergedOptions = textOptions.map((option, index) => {
        const generatedOption = generatedOptions[index];

        return generatedOption
          ? {
              ...option,
              visualKeyword:
                generatedOption.visualKeyword ??
                option.visualKeyword ??
                option.label,
              imageUrl: generatedOption.imageUrl ?? option.imageUrl ?? null,
              emoji: generatedOption.emoji ?? option.emoji ?? null,
              source: generatedOption.source ?? option.source ?? null,
              provider: generatedOption.provider ?? option.provider ?? null,
            }
          : option;
      });

      setResolvedOptions(mergedOptions);
      setRemovedVisualIndexes(new Set());

      setOptionImageUrls(
        mergedOptions.map((option) => option.imageUrl ?? ""),
      );

      const hasSimpleFallbackVisuals = mergedOptions.some((option) => {
        const source = option.source?.toLowerCase() ?? "";
        const provider = option.provider?.toLowerCase() ?? "";
        return (
          source.includes("fallback") ||
          source.includes("emoji") ||
          provider.includes("mock")
        );
      });

      showMessage(
        "Visuals ready",
        hasSimpleFallbackVisuals
          ? "Some options used simpler fallback visuals. Please check each image before sending. You can keep, change, or remove any visual."
          : "Generated visuals are suggestions. Please check that each image matches the option before sending. You can change or remove any visual.",
      );
    } catch (error) {
      console.error("Failed to generate visuals:", error);

      showMessage(
        "Could not generate visuals",
        "Visuals could not be generated right now. You can still send with text, use emoji, or add your own images.",
      );
    } finally {
      isGeneratingVisualsRef.current = false;
      setIsGeneratingVisuals(false);
    }
  };

  const showImageSourceMenu = (index: number) => {
    if (Platform.OS === "web") {
      handleChooseFromGallery(index);
      return;
    }

    const visualRemoved = removedVisualIndexes.has(index);
    const hasImage = !!optionImageUrls[index] && !visualRemoved;

    Alert.alert(
      hasImage ? "Change option image" : "Add option image",
      "Choose how you want to add the image.",
      hasImage
        ? [
            {
              text: "Take photo",
              onPress: () => handleTakePhoto(index),
            },
            {
              text: "Choose from gallery",
              onPress: () => handleChooseFromGallery(index),
            },
            {
              text: "Remove visual",
              style: "destructive",
              onPress: () => handleRemoveVisual(index),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        : [
            {
              text: "Take photo",
              onPress: () => handleTakePhoto(index),
            },
            {
              text: "Choose from gallery",
              onPress: () => handleChooseFromGallery(index),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ],
    );
  };

  const handleSend = async () => {
    if (isImageWorkInProgress) {
      Alert.alert(
        "Visuals still preparing",
        "Please wait until the visuals are ready before sending this session.",
      );
      return;
    }

    const cleanedLabels = optionLabels.map((label) => label.trim());

    if (cleanedLabels.length < 2 || cleanedLabels.some((label) => !label)) {
      Alert.alert(
        "Check answer options",
        "Please keep at least two options and fill in every option before sending.",
      );
      return;
    }

    const session = buildDraftSession();

    try {
      let latestAttentionAlertsReady = areAttentionAlertsReady;

      try {
        const currentSession = await getCurrentSession(roomId);
        latestAttentionAlertsReady = !!currentSession?.childFcmToken;
      } catch (readError) {
        console.warn("Could not check alert readiness before send", readError);
      }

      await sendSession(session, roomId);

      try {
        const latestSession = await getCurrentSession(roomId);
        latestAttentionAlertsReady =
          latestAttentionAlertsReady && !!latestSession?.childFcmToken;
      } catch (readError) {
        console.warn("Could not refresh alert readiness after send", readError);
      }

      setSendNoticeMessage(
        latestAttentionAlertsReady
          ? "Sent to child."
          : "Sent. Child can still answer in the app, but attention alerts may not appear.",
      );
      if (sendNoticeTimeoutRef.current) {
        clearTimeout(sendNoticeTimeoutRef.current);
      }
      sendNoticeTimeoutRef.current = setTimeout(() => {
        setSendNoticeMessage("");
        sendNoticeTimeoutRef.current = null;
      }, 3500);
      onSendToChild?.();
    } catch (e) {
      console.warn("sendSession failed", e);
      Alert.alert(
        "Could not send",
        "Check your connection and try again.",
      );
    }
  };

  const handleReset = async () => {
    try {
      await resetSession(roomId);
      setFireSession(null);
      onClearSession();
    } catch (e) {
      console.warn("resetSession failed", e);
      Alert.alert(
        "Could not clear session",
        "Check your connection and try again.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={8}
      style={styles.flexFill}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          styles.parentScrollContent,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.parentHeaderRow}>
          <View>
            <Text style={styles.parentHeaderTitle}>Parent Mode</Text>
            <Text style={styles.parentHeaderRoom}>Room: {roomId}</Text>
            <Text style={styles.parentHeaderRoom}>
              Attention alerts: {areAttentionAlertsReady ? "Ready" : "Not ready"}
            </Text>
          </View>
          <TouchableOpacity style={styles.resetButton} onPress={onResetSetup}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.parentTabRow}>
          <TouchableOpacity
            style={[
              styles.parentTabButton,
              activeParentTab === "create" && styles.parentTabButtonActive,
            ]}
            onPress={() => setActiveParentTab("create")}
          >
            <Text
              style={[
                styles.parentTabButtonText,
                activeParentTab === "create" &&
                  styles.parentTabButtonTextActive,
              ]}
            >
              Create
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.parentTabButton,
              activeParentTab === "history" && styles.parentTabButtonActive,
            ]}
            onPress={() => setActiveParentTab("history")}
          >
            <Text
              style={[
                styles.parentTabButtonText,
                activeParentTab === "history" &&
                  styles.parentTabButtonTextActive,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.parentTabButton,
              activeParentTab === "templates" && styles.parentTabButtonActive,
            ]}
            onPress={() => setActiveParentTab("templates")}
          >
            <Text
              style={[
                styles.parentTabButtonText,
                activeParentTab === "templates" &&
                  styles.parentTabButtonTextActive,
              ]}
            >
              Templates
            </Text>
          </TouchableOpacity>
        </View>
        {activeParentTab === "create" ? (
          <>
            <View style={styles.parentStatusSection}>
              <Text style={styles.parentStatusLabel}>
                Child&apos;s response
              </Text>

              {selectedAnswer ? (
                <View style={styles.parentStatusActive}>
                  <Text style={styles.parentStatusEmoji}>
                    {selectedAnswer.emoji ?? ""}
                  </Text>

                  <View style={styles.parentStatusContent}>
                    <Text style={styles.parentStatusValue}>
                      {selectedAnswer.label}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.parentStatusInactive}>
                  <Text style={styles.parentStatusPlaceholder}>
                    Waiting for response...
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.parentBuildSection}>
              <View style={styles.parentSectionHeader}>
                <Text style={styles.parentSectionTitle}>
                  {isEditingTemplate ? "Edit template" : "Create a session"}
                </Text>
                {sentSession && (
                  <Text style={styles.parentSectionBadge}>Live</Text>
                )}
              </View>

              {isEditingTemplate ? (
                <View style={styles.editTemplateNotice}>
                  <View style={styles.editTemplateNoticeTextWrap}>
                    <Text style={styles.editTemplateNoticeLabel}>
                      Editing template
                    </Text>
                    <Text
                      style={styles.editTemplateNoticeName}
                      numberOfLines={1}
                    >
                      {editingTemplateName}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.editTemplateCancelButton}
                    onPress={onCancelTemplateEdit}
                  >
                    <Text style={styles.editTemplateCancelText}>Stop Editing</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {templateNoticeVisible ? (
                <View style={styles.templateAddedNotice}>
                  <View style={styles.templateAddedIcon}>
                    <Text style={styles.templateAddedIconText}>✓</Text>
                  </View>
                  <Text style={styles.templateAddedText}>
                    Template added. You can edit it before sending.
                  </Text>
                </View>
              ) : null}

              {historyNoticeMessage ? (
                <View style={styles.templateAddedNotice}>
                  <Text style={styles.templateAddedText}>
                    {historyNoticeMessage}
                  </Text>
                </View>
              ) : null}

              <View style={styles.parentInputGroup}>
                <Text style={styles.parentInputLabel}>Quick templates</Text>

                <View style={styles.templateChipRow}>
                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => applyBuiltInTemplate("food")}
                  >
                    <Text style={styles.previewToggleText}>Food</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => applyBuiltInTemplate("feelings")}
                  >
                    <Text style={styles.previewToggleText}>Feelings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => applyBuiltInTemplate("activities")}
                  >
                    <Text style={styles.previewToggleText}>Activities</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => applyBuiltInTemplate("yesNo")}
                  >
                    <Text style={styles.previewToggleText}>Yes / No</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.savedTemplateSection}>
                  <View style={styles.savedTemplateMiniHeaderRow}>
                    <Text style={styles.savedTemplateTitle}>My templates</Text>

                    {savedTemplates.length > 3 ? (
                      <TouchableOpacity onPress = {() => setActiveParentTab("templates")}>
                        <Text style={styles.savedTemplateViewAllText}>View all</Text>
                      </TouchableOpacity>
                    ): null}
                  </View>

                  {savedTemplates.length > 0 ? (
                    <View style={styles.templateChipRow}>
                      {savedTemplates.slice(0, 3).map((template) => (
                        <TouchableOpacity
                          key={template.id}
                          style={styles.savedTemplateSimpleChip}
                          onPress={() => applySavedTemplate(template.id)}
                        >
                          <Text
                            style={styles.savedTemplateSimpleChipText}
                            numberOfLines={1}
                          >
                            {template.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.savedTemplateEmptyText}>
                      Saved templates will appear here.
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  disabled={isImageWorkInProgress}
                  style={[
                    styles.parentGenerateVisualsButton,
                    isImageWorkInProgress && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleGenerateVisuals}
                >
                  <Text style={styles.parentGenerateVisualsButtonText}>
                    {isGeneratingVisuals
                      ? "Generating visuals..."
                      : "Generate visuals"}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.generateVisualsHint}>
                  Symbols and Emoji are tried first. AI works better for
                  concrete objects.
                </Text>

                {isGeneratingVisuals ? (
                  <Text style={styles.parentVisualGenerationStatus}>
                    Finding clear visuals. This can take a moment.
                  </Text>
                ) : null}
              </View>

              <View style={styles.parentInputGroup}>
                <Text style={styles.parentInputLabel}>Question</Text>

                <TextInput
                  accessibilityLabel="Question text"
                  cursorColor="#A97E57"
                  placeholder="Ask a calm question..."
                  placeholderTextColor="#D4C4B8"
                  selectionColor="#D8B48F"
                  style={styles.parentQuestionInput}
                  value={question}
                  onChangeText={onQuestionChange}
                  multiline
                />
              </View>

              <View style={styles.parentInputGroup}>
                <Text style={styles.parentInputLabel}>
                  Speech sentence pattern
                </Text>

                <TextInput
                  accessibilityLabel="Speech sentence pattern"
                  cursorColor="#A97E57"
                  placeholder={DEFAULT_SPEECH_TEMPLATE}
                  placeholderTextColor="#D4C4B8"
                  selectionColor="#D8B48F"
                  style={styles.textInput}
                  value={speechTemplate}
                  onChangeText={onSpeechTemplateChange}
                />

                <Text style={styles.parentOptionsHint}>
                  Use {"{option}"} where the answer should go, like I feel{" "}
                  {"{option}"} or I need {"{option}"}.
                </Text>
              </View>

              <View style={styles.parentInputGroup}>
                <View style={styles.answerOptionsHeaderRow}>
                  <Text style={styles.parentInputLabel}>Answer options</Text>

                  <TouchableOpacity
                    style={styles.saveTemplateInlineButton}
                    onPress={openSaveTemplateModal}
                    disabled={isImageWorkInProgress}
                  >
                    <Text style={styles.saveTemplateInlineButtonText}>
                      {isEditingTemplate ? "Update template" : "Save template"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.parentOptionsList}>
                  {optionLabels.map((label, index) => {
                    const visualRemoved = removedVisualIndexes.has(index);
                    const hasImage = !!optionImageUrls[index] && !visualRemoved;
                    const hasResolvedVisual =
                      !!resolvedOptions?.[index]?.imageUrl ||
                      !!resolvedOptions?.[index]?.emoji;
                    const hasAnyVisual =
                      !visualRemoved && (hasImage || hasResolvedVisual);
                    const isUploading = uploadingImageIndex === index;

                    return (
                      <View
                        key={`draft-${index}`}
                        style={styles.parentOptionCompactRow}
                      >
                        <View style={styles.parentOptionIndexBadge}>
                          <View style={styles.parentOptionIndexInner}>
                            <Text style={styles.parentOptionIndexText}>
                              {index + 1}
                            </Text>
                          </View>
                        </View>

                        <TextInput
                          accessibilityLabel={`Option ${index + 1} label`}
                          cursorColor="#A97E57"
                          placeholder={`Option ${index + 1}`}
                          placeholderTextColor="#D4C4B8"
                          selectionColor="#D8B48F"
                          style={styles.parentOptionCompactInput}
                          value={label}
                          onChangeText={(value) =>
                            onOptionLabelChange(index, value)
                          }
                        />

                        <View style={styles.parentOptionCompactActions}>
                          <TouchableOpacity
                            style={[
                              styles.parentMiniImageButton,
                              hasAnyVisual && styles.parentMiniImageButtonReady,
                            ]}
                            onPress={() => showImageSourceMenu(index)}
                            disabled={isUploading}
                          >
                            <Text style={styles.parentMiniImageButtonText}>
                              {isUploading
                                ? "..."
                                : hasAnyVisual
                                  ? "Change"
                                  : "Add"}
                            </Text>
                          </TouchableOpacity>

                          {hasAnyVisual ? (
                            <TouchableOpacity
                              style={styles.parentMiniImageRemoveButton}
                              onPress={() => handleRemoveVisual(index)}
                              disabled={isUploading}
                            >
                              <Text
                                style={styles.parentMiniImageRemoveButtonText}
                              >
                                Remove
                              </Text>
                            </TouchableOpacity>
                          ) : null}

                          {optionLabels.length > 2 ? (
                            <TouchableOpacity
                              style={styles.parentMiniOptionDeleteButton}
                              onPress={() => handleRemoveOption(index)}
                              disabled={isUploading}
                            >
                              <Text
                                style={styles.parentMiniOptionDeleteButtonText}
                              >
                                Delete
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.parentAddOptionButton}
                  onPress={handleAddOption}
                  disabled={isImageWorkInProgress}
                >
                  <Text style={styles.parentAddOptionButtonText}>
                    Add option
                  </Text>
                </TouchableOpacity>

                <Text style={styles.parentOptionsHint}>
                  Optional: add or change images here. For generated visuals,
                  put the picture word in [brackets], e.g. play [soccer].
                </Text>
              </View>

              <View style={styles.parentPreviewToggle}>
                <TouchableOpacity
                  style={styles.previewToggleButton}
                  onPress={onPreviewToggle}
                >
                  <Text style={styles.previewToggleText}>
                    {showPreview ? "Hide preview" : "Preview"}
                  </Text>
                </TouchableOpacity>
              </View>

              {showPreview ? (
                <View style={styles.parentPreviewBox}>
                  <Text style={styles.parentPreviewTitle}>
                    {previewSession.title || "Your question"}
                  </Text>

                  <View style={styles.parentPreviewGrid}>
                    {previewSession.options.map((option) => (
                      <OptionCard
                        key={option.id}
                        option={option}
                        compact
                        disabled
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.parentActionSection}>
              <TouchableOpacity
                disabled={isImageWorkInProgress}
                style={[
                  styles.primaryButton,
                  isImageWorkInProgress && styles.primaryButtonDisabled,
                ]}
                onPress={handleSend}
              >
                <Text style={styles.primaryButtonText}>
                  {isImageWorkInProgress
                    ? "Generating Visuals..."
                    : isUploadingImage
                      ? "Uploading Image..."
                      : "Send To Child"}
                </Text>
              </TouchableOpacity>

              {sendNoticeMessage ? (
                <View style={styles.parentSendNotice}>
                  <Text style={styles.parentSendNoticeText}>
                    {sendNoticeMessage}
                  </Text>
                </View>
              ) : null}

              {sentSession && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleReset}
                >
                  <Text style={styles.secondaryButtonText}>Clear session</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.parentSubtleFooterText}>
                Generated visuals are suggestions. Check each image before
                sending. You can change or remove any visual.
              </Text>
            </View>
          </>
        ) : null}
        {activeParentTab === "history" ? (
          <View style={styles.parentStatusSection}>
            <Text style={styles.parentStatusLabel}>Recent history</Text>

            {historyNoticeMessage ? (
              <View style={styles.templateAddedNotice}>
                <Text style={styles.templateAddedText}>
                  {historyNoticeMessage}
                </Text>
              </View>
            ) : null}

            {fireSession?.status === "sent" ? (
              <View style={[styles.historyCard, styles.historyPendingCard]}>
                <View style={styles.historyHeaderRow}>
                  <Text style={styles.historyStatusText}>Waiting for answer</Text>
                  <Text style={styles.historyTime}>
                    {formatHistoryTimestamp(fireSession.createdAt)}
                  </Text>
                </View>
                <Text style={styles.historyLabel}>Question</Text>
                <Text style={styles.historyQuestion}>{fireSession.title}</Text>
                {fireSession.speechTemplate ? (
                  <>
                    <Text style={styles.historyLabel}>Speech pattern</Text>
                    <Text style={styles.historyQuestion}>
                      {fireSession.speechTemplate}
                    </Text>
                  </>
                ) : null}
                <Text style={styles.historyLabel}>Child answer</Text>
                <Text style={styles.historyPendingAnswer}>
                  Not answered yet
                </Text>
              </View>
            ) : null}

            {sessionHistory.length > 0 ? (
              sessionHistory.map((item) => {
                const reusableOptions = getReusableHistoryOptions(item);
                const canUseHistoryActions =
                  reusableOptions.length >= MIN_REUSABLE_HISTORY_OPTIONS;
                const speechPracticeText = getHistorySpeechPracticeText(item);

                return (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyHeaderRow}>
                    <Text style={styles.historyStatusText}>Answered</Text>
                    <Text style={styles.historyTime}>
                      {formatHistoryTimestamp(item.createdAt)}
                    </Text>
                  </View>

                  <Text style={styles.historyLabel}>Question</Text>
                  <Text style={styles.historyQuestion}>{item.question}</Text>

                  <Text style={styles.historyLabel}>Child answer</Text>
                  <Text style={styles.historyAnswer}>
                    {item.answerEmoji ? `${item.answerEmoji} ` : ""}
                    {item.answer || "No answer recorded"}
                  </Text>

                  {speechPracticeText ? (
                    <>
                      <Text style={styles.historyLabel}>Speech practice</Text>
                      <Text style={styles.historyQuestion}>
                        {speechPracticeText}
                      </Text>
                    </>
                  ) : null}

                  {canUseHistoryActions ? (
                    <View style={styles.historyActionRow}>
                      <TouchableOpacity
                        style={styles.historyReuseButton}
                        onPress={() => handleUseHistoryItem(item)}
                      >
                        <Text style={styles.historyReuseButtonText}>
                          Use again
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.historyReuseButton}
                        onPress={() => handleSaveHistoryTemplate(item)}
                      >
                        <Text style={styles.historyReuseButtonText}>
                          Save as template
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.historyUnavailableText}>
                      Reuse is unavailable for this older history item.
                    </Text>
                  )}
                </View>
                );
              })
            ) : (
              <View style={styles.historyEmptyCard}>
                <Text style={styles.historyEmptyText}>
                  No answered sessions yet. Responses will appear here after
                  the child sends an answer.
                </Text>
              </View>
            )}
          </View>
        ) : null}
        {activeParentTab === "templates" ? (
          <>
            <View style={styles.parentBuildSection}>
              <View style={styles.parentSectionHeader}>
                <Text style={styles.parentSectionTitle}>Templates</Text>
              </View>

              <View style={styles.parentInputGroup}>
                <Text style={styles.parentInputLabel}>Built-in templates</Text>

                <View style={styles.templateChipRow}>
                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => {
                      applyBuiltInTemplate("food");
                      setActiveParentTab("create");
                    }}
                  >
                    <Text style={styles.previewToggleText}>Food</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => {
                      applyBuiltInTemplate("feelings");
                      setActiveParentTab("create");
                    }}
                  >
                    <Text style={styles.previewToggleText}>Feelings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => {
                      applyBuiltInTemplate("activities");
                      setActiveParentTab("create");
                    }}
                  >
                    <Text style={styles.previewToggleText}>Activities</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => {
                      applyBuiltInTemplate("yesNo");
                      setActiveParentTab("create");
                    }}
                  >
                    <Text style={styles.previewToggleText}>Yes/No</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.parentInputGroup}>
                <Text style={styles.parentInputLabel}>My templates</Text>

                {savedTemplates.length > 0 ? (
                  <View style={styles.templateCardList}>
                    {savedTemplates.map((template) => (
                      <View key={template.id} style={styles.templateManageCard}>
                        <View style={styles.templateManageContent}>
                          <Text
                            style={styles.templateManageTitle}
                            numberOfLines={1}
                          >
                            {template.name}
                          </Text>

                          <Text
                            style={styles.templateManageQuestion}
                            numberOfLines={2}
                          >
                            {template.question}
                          </Text>

                          <Text
                            style={styles.templateManageMeta}
                            numberOfLines={1}
                          >
                            {template.options.filter(Boolean).length} options
                          </Text>

                          <Text
                            style={styles.templateManageMeta}
                            numberOfLines={1}
                          >
                            Speech pattern:{" "}
                            {template.speechTemplate?.trim() ||
                              DEFAULT_SPEECH_TEMPLATE}
                          </Text>
                        </View>

                        <View style={styles.templateManageActions}>
                          <TouchableOpacity
                            style={styles.templateEditButton}
                            onPress={() => {
                              onEditSavedTemplate(template.id);
                              setActiveParentTab("create");
                            }}
                          >
                            <Text style={styles.templateEditButtonText}>
                              Edit
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.templateUseButton}
                            onPress={() => {
                              applySavedTemplate(template.id);
                              setActiveParentTab("create");
                            }}
                          >
                            <Text style={styles.templateUseButtonText}>
                              Use
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.templateDeleteButton}
                            onPress={() => onDeleteSavedTemplate(template.id)}
                          >
                            <Text style={styles.templateDeleteButtonText}>
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.historyEmptyCard}>
                    <Text style={styles.historyEmptyText}>
                      Saved templates will appear here after you save one from
                      the Create tab.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
      <Modal
        transparent
        visible={isSavedTemplateModalVisible}
        animationType="fade"
        onRequestClose={handleCancelSaveTemplate}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.saveTemplateModalCard}>
            <Text style={styles.saveTemplateModalTitle}>
              {isEditingTemplate ? "Update template" : "Save template"}
            </Text>

            <Text style={styles.saveTemplateModalSubtitle}>
              {isEditingTemplate
                ? "Update the name, question, and options for this template."
                : "Give this set of question and options a name."}
            </Text>

            <TextInput
              cursorColor="#A97E57"
              placeholder="Example: Dinner choices"
              placeholderTextColor="#B8A89D"
              selectionColor="#D8B48F"
              style={styles.saveTemplateModalInput}
              value={templateNameInput}
              onChangeText={setTemplateNameInput}
            />

            <View style={styles.saveTemplateModalActions}>
              <TouchableOpacity
                style={styles.saveTemplateModalCancelButton}
                onPress={handleCancelSaveTemplate}
              >
                <Text style={styles.saveTemplateModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveTemplateModalSaveButton}
                onPress={handleConfirmSaveTemplate}
              >
                <Text style={styles.saveTemplateModalSaveText}>
                  {isEditingTemplate ? "Update" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

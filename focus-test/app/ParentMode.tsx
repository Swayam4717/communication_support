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
  createdAt: number;
};

interface ParentModeScreenProps {
  question: string;
  optionLabels: string[];
  sentSession: CommunicationSession | null;
  showPreview: boolean;
  roomId: string;
  templateVersion: number;
  savedTemplates: savedSessionTemplate[];
  editingTemplateName: string | null;
  onQuestionChange: (value: string) => void;
  onOptionLabelChange: (index: number, value: string) => void;
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

export default function ParentModeScreen({
  question,
  optionLabels,
  sentSession,
  showPreview,
  roomId,
  templateVersion,
  savedTemplates,
  editingTemplateName,
  onQuestionChange,
  onOptionLabelChange,
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
    const baseSession = resolvedOptions
      ? createSessionWithResolvedOptions(question, resolvedOptions)
      : createSession(question, optionLabels, optionImageUrls);

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
    if (optionLabels.every((label) => !label.trim())) {
      Alert.alert(
        "Add options first",
        "Please add at least one option before saving a template.",
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
    if (isEditingTemplate) {
      onCancelTemplateEdit();
    }

    const historyOptions =
      item.options && item.options.length > 0
        ? item.options
        : [
            {
              id: "1",
              label: item.answer,
              emoji: item.answerEmoji,
            },
          ];

    onQuestionChange(item.question);
    optionLabels.forEach((_, index) => {
      onOptionLabelChange(index, historyOptions[index]?.label ?? "");
    });
    setResolvedOptions(
      item.options && item.options.length > 0 ? item.options : null,
    );
    setRemovedVisualIndexes(new Set());
    setOptionImageUrls(
      optionLabels.map((_, index) => historyOptions[index]?.imageUrl ?? ""),
    );
    setActiveParentTab("create");
    showHistoryNotice("Loaded from history. You can edit before sending.");
  };

  const handleSaveHistoryTemplate = async (item: SessionHistoryItem) => {
    if (!item.options || item.options.length === 0) {
      return;
    }

    const saved = await onSaveHistoryTemplate(
      item.question,
      item.options.map((option) => option.label),
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
    if (cleanedLabels.length === 0) {
      showMessage(
        "Add options First",
        "Please enter at least one option before generating visuals",
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

      setResolvedOptions(generatedOptions);
      setRemovedVisualIndexes(new Set());

      setOptionImageUrls(
        generatedOptions.map((option) => option.imageUrl ?? ""),
      );

      const hasSimpleFallbackVisuals = generatedOptions.some((option) => {
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
          ? "Some options used simpler fallback visuals. You can keep them, remove them, or add your own images before sending."
          : "Visuals were added to the option cards. Review them before sending.",
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

                <Text style={styles.parentOptionsHint}>
                  Add images only when needed. Visuals can also be generated
                  automatically.
                </Text>

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
                        </View>
                      </View>
                    );
                  })}
                </View>
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
                <Text style={styles.historyLabel}>Child answer</Text>
                <Text style={styles.historyPendingAnswer}>
                  Not answered yet
                </Text>
              </View>
            ) : null}

            {sessionHistory.length > 0 ? (
              sessionHistory.map((item) => (
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

                  <View style={styles.historyActionRow}>
                    <TouchableOpacity
                      style={styles.historyReuseButton}
                      onPress={() => handleUseHistoryItem(item)}
                    >
                      <Text style={styles.historyReuseButtonText}>
                        Use again
                      </Text>
                    </TouchableOpacity>

                    {item.options && item.options.length > 0 ? (
                      <TouchableOpacity
                        style={styles.historyReuseButton}
                        onPress={() => handleSaveHistoryTemplate(item)}
                      >
                        <Text style={styles.historyReuseButtonText}>
                          Save as template
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))
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

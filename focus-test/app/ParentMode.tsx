import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
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
  DEFAULT_SPEECH_ASSISTANT_ENABLED,
  DEFAULT_SPEECH_TEMPLATE,
  DEFAULT_VISUAL_ONLY_MODE,
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
import { styles } from "./communicationCommon";
import { FormattedQuestionText, OptionCard } from "./communicationUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type sessionTemplateId = "food" | "feelings" | "activities" | "yesNo";
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

const MIN_REUSABLE_HISTORY_OPTIONS = 2;
const MAX_REUSABLE_HISTORY_OPTIONS = 12;
const MAX_REUSABLE_HISTORY_LABEL_LENGTH = 60;
const MAX_REUSABLE_HISTORY_META_LENGTH = 80;
const MAX_REUSABLE_HISTORY_IMAGE_URL_LENGTH = 2048;
type ParentResponseMode =
  | "onlyImages"
  | "speechVerification"
  | "assistedSpeechVerification";

interface ParentModeScreenProps {
  question: string;
  optionLabels: string[];
  speechTemplate: string;
  initialOptionDetails?: SessionOption[] | null;
  visualOnlyMode: boolean;
  speechAssistantEnabled: boolean;
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
  onVisualOnlyModeChange: (value: boolean) => void;
  onSpeechAssistantEnabledChange: (value: boolean) => void;
  onResetSetup: () => void;
  onApplyTemplate: (templateId: sessionTemplateId) => void;
  onApplySavedTemplate: (templateId: string) => void;
  onEditSavedTemplate: (templateId: string) => void;
  onCancelTemplateEdit: () => void;
  onSaveCurrentTemplate: (
    templateName?: string,
    optionDetails?: SessionOption[] | null,
  ) => Promise<boolean>;
  onSaveHistoryTemplate: (
    question: string,
    options: string[],
    optionDetails?: SessionOption[] | null,
    speechTemplate?: string | null,
    visualOnlyMode?: boolean | null,
    speechAssistantEnabled?: boolean | null,
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
  initialOptionDetails,
  visualOnlyMode,
  speechAssistantEnabled,
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
  onVisualOnlyModeChange,
  onSpeechAssistantEnabledChange,
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
  const [manualImageIndexes, setManualImageIndexes] = useState<Set<number>>(
    new Set(),
  );
  const [lastGeneratedOptionLabels, setLastGeneratedOptionLabels] = useState<
    string[]
  >(optionLabels.map(() => ""));

  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(
    null,
  );

  const [generatingVisualIndexes, setGeneratingVisualIndexes] = useState<
    Set<number>
  >(new Set());
  const [activeParentTab, setActiveParentTab] = useState<
    "create" | "history" | "templates"
  >("create");
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

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
    setLastGeneratedOptionLabels((currentLabels) =>
      optionLabels.map((_, index) => currentLabels[index] ?? ""),
    );
    setResolvedOptions((currentOptions) =>
      currentOptions
        ? optionLabels.map((label, index) => {
            const existingOption = currentOptions[index];
            const parsedLabel = parseOptionLabelForVisual(label);
            const displayLabel =
              parsedLabel.displayLabel || existingOption?.label || label.trim();

            return existingOption
              ? {
                  ...existingOption,
                  id: String(index + 1),
                  label: displayLabel,
                  visualKeyword:
                    parsedLabel.visualKeyword ||
                    existingOption.visualKeyword ||
                    displayLabel,
                }
              : {
                  id: String(index + 1),
                  label: displayLabel,
                  visualKeyword: parsedLabel.visualKeyword || displayLabel,
                };
          })
        : currentOptions,
    );
  }, [optionLabels]);

  React.useEffect(() => {
    const nextInitialOptions = initialOptionDetails?.length
      ? optionLabels.map((label, index) => {
          const initialOption = initialOptionDetails[index];
          const parsedLabel = parseOptionLabelForVisual(
            label || initialOption?.label || "",
          );
          const displayLabel =
            parsedLabel.displayLabel ||
            initialOption?.label ||
            label.trim() ||
            `Option ${index + 1}`;

          return initialOption
            ? {
                ...initialOption,
                id: String(index + 1),
                label: displayLabel,
                visualKeyword:
                  parsedLabel.visualKeyword ||
                  initialOption.visualKeyword ||
                  displayLabel,
              }
            : {
                id: String(index + 1),
                label: displayLabel,
                visualKeyword: parsedLabel.visualKeyword || displayLabel,
              };
        })
      : null;

    setOptionImageUrls(
      optionLabels.map((_, index) => nextInitialOptions?.[index]?.imageUrl ?? ""),
    );
    setLastGeneratedOptionLabels(
      optionLabels.map((label, index) =>
        nextInitialOptions?.[index]?.source === "default" ? label.trim() : "",
      ),
    );
    setResolvedOptions(nextInitialOptions);
    setRemovedVisualIndexes(new Set());
    setManualImageIndexes(
      new Set(
        nextInitialOptions
          ?.map((option, index) =>
            option.imageUrl && option.source === "manual" ? index : -1,
          )
          .filter((index) => index >= 0) ?? [],
      ),
    );
    setGeneratingVisualIndexes(new Set());
  }, [templateVersion]);

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
          resolvedOptions.map((option, index) => {
            const parsedLabel = parseOptionLabelForVisual(
              cleanedOptionLabels[index] || option.label,
            );

            return {
              ...option,
              id: String(index + 1),
              label: parsedLabel.displayLabel || option.label,
              visualKeyword:
                parsedLabel.visualKeyword ||
                option.visualKeyword ||
                option.label,
            };
          }),
          speechTemplate,
          visualOnlyMode,
          speechAssistantEnabled,
        )
      : createSession(
          question,
          cleanedOptionLabels,
          optionImageUrls,
          speechTemplate,
          visualOnlyMode,
          speechAssistantEnabled,
        );

    return applyRemovedVisuals(baseSession);
  };

  const selectedResponseMode: ParentResponseMode = visualOnlyMode
    ? "onlyImages"
    : speechAssistantEnabled
      ? "assistedSpeechVerification"
      : "speechVerification";
  const responseModeOptions: Array<{
    id: ParentResponseMode;
    label: string;
    description: string;
  }> = [
    {
      id: "assistedSpeechVerification",
      label: "Pictures With Guided Speech",
      description: "Child gets word-by-word help while saying the sentence.",
    },
    {
      id: "speechVerification",
      label: "Pictures With Speech",
      description: "Child says the sentence to send the answer.",
    },
    {
      id: "onlyImages",
      label: "Pictures Only",
      description: "Child selects a picture and sends the answer.",
    },
  ];
  const selectedResponseModeOption =
    responseModeOptions.find((mode) => mode.id === selectedResponseMode) ??
    responseModeOptions[0];
  const draftPreviewSession = buildDraftSession();
  const previewOptions = draftPreviewSession.options.map((option, index) => {
    const visualRemoved = removedVisualIndexes.has(index);
    const resolvedOption = resolvedOptions?.[index];
    const imageUrl = !visualRemoved
      ? optionImageUrls[index] || option.imageUrl || resolvedOption?.imageUrl || null
      : null;
    return {
      ...option,
      imageUrl,
      emoji: null,
    };
  });
  const previewSpeechPhrase =
    !visualOnlyMode
      ? speechTemplate.trim() || DEFAULT_SPEECH_TEMPLATE
      : "";

  const setResponseMode = (mode: ParentResponseMode) => {
    setIsModeMenuOpen(false);

    if (mode === "onlyImages") {
      onVisualOnlyModeChange(true);
      onSpeechAssistantEnabledChange(false);
      return;
    }

    onVisualOnlyModeChange(false);
    onSpeechAssistantEnabledChange(mode === "assistedSpeechVerification");
  };

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

  const setOptionImageUrl = (
    index: number,
    imageUrl: string,
    source: "manual" | "default" = "manual",
  ) => {
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

    setManualImageIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      if (source === "manual") {
        nextIndexes.add(index);
      } else {
        nextIndexes.delete(index);
      }
      return nextIndexes;
    });

    setResolvedOptions((currentOptions) =>
      currentOptions
        ? currentOptions.map((option, optionIndex) =>
            optionIndex === index
              ? {
                  ...option,
                  imageUrl,
                  emoji: null,
                  source,
                  provider: source,
                }
              : option,
          )
        : currentOptions,
    );
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

    setOptionImageUrl(index, downloadUrl, "manual");
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
        "Please keep at least two options and fill in every option before saving.",
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
    const saved = await onSaveCurrentTemplate(
      templateNameInput,
      buildDraftSession().options,
    );
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
    onVisualOnlyModeChange(item.visualOnlyMode ?? DEFAULT_VISUAL_ONLY_MODE);
    onSpeechAssistantEnabledChange(
      item.speechAssistantEnabled ?? DEFAULT_SPEECH_ASSISTANT_ENABLED,
    );
    onOptionLabelsReplace(historyOptions.map((option) => option.label));
    setResolvedOptions(historyOptions);
    setRemovedVisualIndexes(new Set());
    setOptionImageUrls(
      historyOptions.map((option) => option.imageUrl ?? ""),
    );
    setActiveParentTab("create");
    showHistoryNotice("Loaded from responses. You can edit before sending.");
  };

  const handleSaveHistoryTemplate = async (item: SessionHistoryItem) => {
    const historyOptions = getReusableHistoryOptions(item);

    if (historyOptions.length < MIN_REUSABLE_HISTORY_OPTIONS) {
      showHistoryNotice(
        "This older response cannot be saved because its full options were not saved.",
      );
      return;
    }

    const saved = await onSaveHistoryTemplate(
      item.question,
      historyOptions.map((option) => option.label),
      historyOptions,
      item.speechTemplate,
      item.visualOnlyMode,
      item.speechAssistantEnabled,
    );

    if (saved) {
      showHistoryNotice("Saved for future use.");
    }
  };

  const handleRemoveVisual = (index: number) => {
    setManualImageIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      nextIndexes.delete(index);
      return nextIndexes;
    });

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
    setOptionImageUrls((currentUrls) => [...currentUrls, ""]);
    setLastGeneratedOptionLabels((currentLabels) => [...currentLabels, ""]);
    onAddOption();
  };

  const handleRemoveOption = (index: number) => {
    if (optionLabels.length <= 1) {
      showMessage(
        "Keep one option",
        "Please keep at least one answer option.",
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
    setLastGeneratedOptionLabels((currentLabels) =>
      currentLabels.filter((_, optionIndex) => optionIndex !== index),
    );
    setManualImageIndexes((currentIndexes) => {
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
    setGeneratingVisualIndexes((currentIndexes) => {
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
  const isGeneratingAnyOptionVisual = generatingVisualIndexes.size > 0;
  const isImageWorkInProgress =
    isUploadingImage || isGeneratingAnyOptionVisual;
  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const handleGenerateOptionVisual = async (
    index: number,
    options: { force?: boolean } = {},
  ) => {
    if (uploadingImageIndex !== null || generatingVisualIndexes.has(index)) {
      return;
    }

    const rawLabel = optionLabels[index] ?? "";
    const cleanedLabel = rawLabel.trim();

    if (!cleanedLabel) {
      return;
    }

    if (!options.force) {
      if (manualImageIndexes.has(index)) {
        return;
      }

      if (lastGeneratedOptionLabels[index] === cleanedLabel) {
        return;
      }
    }

    setGeneratingVisualIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      nextIndexes.add(index);
      return nextIndexes;
    });

    try {
      const [generatedOption] = await generateOptionVisualsFromCloud(question, [
        cleanedLabel,
      ]);
      const parsedLabel = parseOptionLabelForVisual(cleanedLabel);
      const baseOption: SessionOption = {
        id: String(index + 1),
        label: parsedLabel.displayLabel || cleanedLabel,
        visualKeyword: parsedLabel.visualKeyword || cleanedLabel,
      };
      const nextOption: SessionOption = generatedOption
        ? {
            ...baseOption,
            visualKeyword:
              generatedOption.visualKeyword ??
              baseOption.visualKeyword ??
              baseOption.label,
            imageUrl: generatedOption.imageUrl ?? null,
            emoji: generatedOption.emoji ?? null,
            source: generatedOption.source ?? null,
            provider: generatedOption.provider ?? null,
          }
        : {
            ...baseOption,
            imageUrl: null,
            emoji: null,
            source: "none",
            provider: "manual",
          };

      setResolvedOptions((currentOptions) => {
        const textOptions = createSession(
          question,
          optionLabels,
          optionImageUrls,
          speechTemplate,
          visualOnlyMode,
          speechAssistantEnabled,
        ).options;
        const nextOptions = optionLabels.map((optionLabel, optionIndex) => {
          const existingOption = currentOptions?.[optionIndex];
          const textOption = textOptions[optionIndex];

          if (existingOption) {
            return existingOption;
          }

          if (textOption) {
            return textOption;
          }

          const parsedLabel = parseOptionLabelForVisual(optionLabel);
          const fallbackLabel =
            parsedLabel.displayLabel || optionLabel.trim() || `Option ${optionIndex + 1}`;

          return {
            id: String(optionIndex + 1),
            label: fallbackLabel,
            visualKeyword: parsedLabel.visualKeyword || fallbackLabel,
          };
        });
        nextOptions[index] = nextOption;
        return nextOptions;
      });
      setOptionImageUrls((currentUrls) => {
        const nextUrls = [...currentUrls];
        nextUrls[index] = nextOption.imageUrl ?? "";
        return nextUrls;
      });
      setManualImageIndexes((currentIndexes) => {
        const nextIndexes = new Set(currentIndexes);
        nextIndexes.delete(index);
        return nextIndexes;
      });
      setLastGeneratedOptionLabels((currentLabels) => {
        const nextLabels = [...currentLabels];
        nextLabels[index] = cleanedLabel;
        return nextLabels;
      });
      setRemovedVisualIndexes((currentIndexes) => {
        const nextIndexes = new Set(currentIndexes);
        if (nextOption.imageUrl || nextOption.emoji) {
          nextIndexes.delete(index);
        }
        return nextIndexes;
      });
    } catch (error) {
      console.warn("Failed to generate option visual", error);
      showMessage(
        "Could not get default image",
        "No reliable default image could be loaded right now. You can keep this option text-only or pick an image.",
      );
    } finally {
      setGeneratingVisualIndexes((currentIndexes) => {
        const nextIndexes = new Set(currentIndexes);
        nextIndexes.delete(index);
        return nextIndexes;
      });
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
  const visibleSessionHistory = sessionHistory.filter(
    (item) => !(fireSession?.status === "sent" && item.id === fireSession.id),
  );

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
      await saveSessionHistory(session, roomId);

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
      setActiveParentTab("history");
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
              Engage
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
              Responses
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
              Saved
            </Text>
          </TouchableOpacity>
        </View>
        {activeParentTab === "create" ? (
          <>
            <View style={styles.parentModeSection}>
              <Text style={styles.parentInputLabel}>Engage With</Text>

              <TouchableOpacity
                style={styles.parentModeDropdownButton}
                activeOpacity={0.85}
                onPress={() => setIsModeMenuOpen((isOpen) => !isOpen)}
              >
                <Text style={styles.parentModeDropdownText}>
                  {selectedResponseModeOption.label}
                </Text>
                <Text style={styles.parentModeDropdownIcon}>
                  {isModeMenuOpen ? "^" : "v"}
                </Text>
              </TouchableOpacity>

              {isModeMenuOpen ? (
                <View style={styles.parentModeDropdownMenu}>
                  {responseModeOptions.map((mode) => (
                    <TouchableOpacity
                      key={mode.id}
                      style={[
                        styles.parentModeDropdownItem,
                        selectedResponseMode === mode.id &&
                          styles.parentModeDropdownItemSelected,
                      ]}
                      onPress={() => setResponseMode(mode.id)}
                    >
                      <Text style={styles.parentModeDropdownItemText}>
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <Text style={styles.parentModeDescription}>
                {selectedResponseModeOption.description}
              </Text>
            </View>

            <View style={styles.parentBuildSection}>
              {isEditingTemplate ? (
                <View style={styles.editTemplateNotice}>
                  <View style={styles.editTemplateNoticeTextWrap}>
                    <Text style={styles.editTemplateNoticeLabel}>
                      Editing saved item
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
                    <Text style={styles.editTemplateCancelText}>Stop editing</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {templateNoticeVisible ? (
                <View style={styles.templateAddedNotice}>
                  <View style={styles.templateAddedIcon}>
                    <Text style={styles.templateAddedIconText}>✓</Text>
                  </View>
                  <Text style={styles.templateAddedText}>
                    Saved item added. You can edit it before sending.
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
                <Text style={styles.parentInputLabel}>Question</Text>

                <TextInput
                  accessibilityLabel="Question text"
                  cursorColor="#A97E57"
                  placeholder="Anything you would like to communciate such as questions, instructions, choices, reminders or encouragement"
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
                </View>

                <View style={styles.parentOptionsList}>
                  {optionLabels.map((label, index) => {
                    const visualRemoved = removedVisualIndexes.has(index);
                    const optionImageUrl =
                      !visualRemoved
                        ? optionImageUrls[index] ||
                          resolvedOptions?.[index]?.imageUrl ||
                          ""
                        : "";
                    const isUploading = uploadingImageIndex === index;
                    const isGeneratingOption =
                      generatingVisualIndexes.has(index);

                    return (
                      <View
                        key={`draft-${index}`}
                        style={styles.parentOptionCard}
                      >
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={styles.parentOptionImagePreview}
                          onPress={() => showImageSourceMenu(index)}
                          disabled={isUploading || isGeneratingOption}
                        >
                          {optionImageUrl ? (
                            <Image
                              source={{ uri: optionImageUrl }}
                              style={styles.parentOptionPreviewImage}
                              resizeMode="contain"
                            />
                          ) : (
                            <Text style={styles.parentOptionNoImageText}>
                              {isUploading ? "Uploading..." : "No image"}
                            </Text>
                          )}
                        </TouchableOpacity>

                        <View style={styles.parentOptionEditBlock}>
                          <View style={styles.parentOptionInputRow}>
                            <TextInput
                              accessibilityLabel={`Option ${index + 1} label`}
                              cursorColor="#A97E57"
                              placeholder="Option"
                              placeholderTextColor="#D4C4B8"
                              selectionColor="#D8B48F"
                              style={styles.parentOptionCompactInput}
                              value={label}
                              returnKeyType="done"
                              onChangeText={(value) =>
                                onOptionLabelChange(index, value)
                              }
                              onSubmitEditing={() =>
                                void handleGenerateOptionVisual(index)
                              }
                              onBlur={() =>
                                void handleGenerateOptionVisual(index)
                              }
                            />

                            <TouchableOpacity
                              style={styles.parentOptionIconButton}
                              onPress={() =>
                                void handleGenerateOptionVisual(index, {
                                  force: true,
                                })
                              }
                              disabled={isUploading || isGeneratingOption}
                            >
                              <Text style={styles.parentOptionRetryIconText}>
                                {isGeneratingOption ? "..." : "R"}
                              </Text>
                            </TouchableOpacity>

                            {optionLabels.length > 1 ? (
                              <TouchableOpacity
                                style={styles.parentOptionRemoveXButton}
                                onPress={() => handleRemoveOption(index)}
                                disabled={isUploading || isGeneratingOption}
                              >
                                <Text style={styles.parentOptionRemoveXText}>
                                  X
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
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
                  Tip: put the picture word in [brackets], e.g. play [soccer].
                </Text>
              </View>

              {!visualOnlyMode ? (
                <View style={styles.parentInputGroup}>
                  <Text style={styles.parentInputLabel}>Speech to Accept</Text>

                  <TextInput
                    accessibilityLabel="Speech to accept"
                    cursorColor="#A97E57"
                    placeholder={DEFAULT_SPEECH_TEMPLATE}
                    placeholderTextColor="#D4C4B8"
                    selectionColor="#D8B48F"
                    style={styles.textInput}
                    value={speechTemplate}
                    onChangeText={onSpeechTemplateChange}
                  />
                </View>
              ) : null}

              <View style={styles.parentInputGroup}>
                <View style={styles.parentPreviewActionRow}>
                  <TouchableOpacity
                    style={styles.parentPreviewToggleButton}
                    onPress={() =>
                      setIsPreviewVisible((isVisible) => !isVisible)
                    }
                  >
                    <Text style={styles.parentPreviewToggleButtonText}>
                      {isPreviewVisible ? "Hide Preview" : "Preview"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.parentPreviewSaveButton}
                    onPress={openSaveTemplateModal}
                    disabled={isImageWorkInProgress}
                  >
                    <Text style={styles.parentPreviewSaveButtonText}>
                      {isEditingTemplate
                        ? "Update saved item"
                        : "Save for future use"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isPreviewVisible ? (
                  <View style={styles.parentPreviewBox}>
                    <FormattedQuestionText
                      text={draftPreviewSession.title || "Your question"}
                      style={styles.parentPreviewTitle}
                      boldStyle={styles.parentPreviewTitleBold}
                    />

                    <View style={styles.parentPreviewGrid}>
                      {previewOptions.map((option) => (
                        <OptionCard
                          key={option.id}
                          option={option}
                          compact
                          disabled
                        />
                      ))}
                    </View>

                    {!visualOnlyMode && previewSpeechPhrase ? (
                      <View
                        style={[
                          styles.speechPracticeCard,
                          styles.parentPreviewSpeechCard,
                        ]}
                      >
                        <Text style={styles.parentPreviewSpeechHeader}>
                          Speech to Accept
                        </Text>
                        <View
                          style={[
                            styles.speechTargetPhraseRow,
                            styles.parentPreviewSpeechTargetRow,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="account-voice"
                            size={18}
                            color="#7F1F1A"
                          />
                          <FormattedQuestionText
                            text={previewSpeechPhrase}
                            style={[
                              styles.speechTargetPhraseText,
                              styles.parentPreviewSpeechTargetText,
                            ]}
                            boldStyle={styles.speechTargetPhraseTextBold}
                          />
                        </View>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={styles.parentPreviewSaveButton}
                      onPress={openSaveTemplateModal}
                      disabled={isImageWorkInProgress}
                    >
                      <Text style={styles.parentPreviewSaveButtonText}>
                        {isEditingTemplate
                          ? "Update saved item"
                          : "Save for future use"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
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
                    ? "Preparing Images..."
                    : isUploadingImage
                      ? "Uploading Image..."
                      : "Send to Child"}
                </Text>
              </TouchableOpacity>

              {sendNoticeMessage ? (
                <View style={styles.parentSendNotice}>
                  <Text style={styles.parentSendNoticeText}>
                    {sendNoticeMessage}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleReset}
              >
                <Text style={styles.secondaryButtonText}>Clear Session</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
        {activeParentTab === "history" ? (
          <View style={styles.parentStatusSection}>
            <Text style={styles.parentStatusLabel}>Responses</Text>

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
                    <Text style={styles.historyLabel}>Speech to Accept</Text>
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

            {visibleSessionHistory.length > 0 ? (
              visibleSessionHistory.map((item) => {
                const reusableOptions = getReusableHistoryOptions(item);
                const canUseHistoryActions =
                  reusableOptions.length >= MIN_REUSABLE_HISTORY_OPTIONS;
                const speechPracticeText = getHistorySpeechPracticeText(item);
                const isAnsweredHistoryItem =
                  item.status === "answered" || !!item.answer;

                return (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyHeaderRow}>
                    <Text style={styles.historyStatusText}>
                      {isAnsweredHistoryItem ? "Answered" : "Sent"}
                    </Text>
                    <Text style={styles.historyTime}>
                      {formatHistoryTimestamp(item.createdAt)}
                    </Text>
                  </View>

                  <Text style={styles.historyLabel}>Question</Text>
                  <Text style={styles.historyQuestion}>{item.question}</Text>

                  <Text style={styles.historyLabel}>Child answer</Text>
                  <Text
                    style={
                      isAnsweredHistoryItem
                        ? styles.historyAnswer
                        : styles.historyPendingAnswer
                    }
                  >
                    {isAnsweredHistoryItem
                      ? `${item.answerEmoji ? `${item.answerEmoji} ` : ""}${
                          item.answer || "No answer recorded"
                        }`
                      : "Not answered yet"}
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
                          Reuse
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.historyReuseButton}
                        onPress={() => handleSaveHistoryTemplate(item)}
                      >
                        <Text style={styles.historyReuseButtonText}>
                          Save for future use
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
                  Responses will appear here after you send a question.
                </Text>
              </View>
            )}
          </View>
        ) : null}
        {activeParentTab === "templates" ? (
          <>
            <View style={styles.parentBuildSection}>
              <View style={styles.parentSectionHeader}>
                <Text style={styles.parentSectionTitle}>Saved</Text>
              </View>

              <View style={styles.parentInputGroup}>
                <Text style={styles.parentInputLabel}>Built-in saved items</Text>

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
                <Text style={styles.parentInputLabel}>Saved items</Text>

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
                            Speech to Accept:{" "}
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
                      Saved items will appear here after you save one from
                      Engage.
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
              {isEditingTemplate ? "Update saved item" : "Save for future use"}
            </Text>

            <Text style={styles.saveTemplateModalSubtitle}>
              {isEditingTemplate
                ? "Update the name, question, and options for this saved item."
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

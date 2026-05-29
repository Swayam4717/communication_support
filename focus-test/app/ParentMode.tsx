import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
  saveSessionHistory,
  subscribeToSessionHistory,
} from "./communicationHelpers";
import { OptionCard } from "./communicationUI";
import { styles } from "./communicationCommon";

type sessionTemplateId = "food" | "feelings" | "activities" | "yesNo";

interface ParentModeScreenProps {
  question: string;
  optionLabels: string[];
  sentSession: CommunicationSession | null;
  showPreview: boolean;
  roomId: string;
  templateVersion: number;
  onQuestionChange: (value: string) => void;
  onOptionLabelChange: (index: number, value: string) => void;
  onPreviewToggle: () => void;
  onSendToChild: () => void;
  onResetSetup: () => void;
  onApplyTemplate: (templateId: sessionTemplateId) => void;
  onClearSession: () => void;
}

export default function ParentModeScreen({
  question,
  optionLabels,
  sentSession,
  showPreview,
  roomId,
  templateVersion,
  onQuestionChange,
  onOptionLabelChange,
  onPreviewToggle,
  onSendToChild,
  onResetSetup,
  onApplyTemplate,
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
  const [activeParentTab, setActiveParentTab] = useState<"create" | "history">(
    "create",
  );

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

  const isChildConnected = !!fireSession?.childFcmToken;

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
    if (isImageWorkInProgress) {
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

      showMessage(
        "Visuals generated",
        "Visuals have been added to the option cards.",
      );
    } catch (error) {
      console.error("Failed to generate visuals:", error);

      showMessage(
        "Could not generate visuals",
        "The visual service has faced some difficulties. You can still send the session without the visuals, or add your own images from the gallery or camera.",
      );
    } finally {
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
      await sendSession(session, roomId);
      onSendToChild?.();
    } catch (e) {
      console.warn("sendSession failed", e);
    }
  };

  const handleReset = async () => {
    try {
      await resetSession(roomId);
      setFireSession(null);
      onClearSession();
    } catch (e) {
      console.warn("resetSession failed", e);
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
              Child: {isChildConnected ? "Connected" : "Not Connected"}
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
                <Text style={styles.parentSectionTitle}>Create a session</Text>
                {sentSession && (
                  <Text style={styles.parentSectionBadge}>Live</Text>
                )}
              </View>

              <View style={styles.parentInputGroup}>
                <Text style={styles.parentInputLabel}>Quick templates</Text>

                <View style={styles.templateChipRow}>
                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => onApplyTemplate("food")}
                  >
                    <Text style={styles.previewToggleText}>Food</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => onApplyTemplate("feelings")}
                  >
                    <Text style={styles.previewToggleText}>Feelings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => onApplyTemplate("activities")}
                  >
                    <Text style={styles.previewToggleText}>Activities</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.previewToggleButton}
                    onPress={() => onApplyTemplate("yesNo")}
                  >
                    <Text style={styles.previewToggleText}>Yes / No</Text>
                  </TouchableOpacity>
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
                <Text style={styles.parentInputLabel}>Answer options</Text>
                <Text style={styles.parentOptionsHint}>
                  Add Images only when needed. Visuals can also be
                  generatedautomatically.
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

            {sessionHistory.length > 0 ? (
              sessionHistory.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <Text style={styles.historyAnswer}>
                    {item.answerEmoji ? `${item.answerEmoji} ` : ""}
                    {item.answer}
                  </Text>

                  <Text style={styles.historyQuestion}>{item.question}</Text>

                  <Text style={styles.historyTime}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.historyEmptyCard}>
                <Text style={styles.historyEmptyText}>
                  No previous responses yet.
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

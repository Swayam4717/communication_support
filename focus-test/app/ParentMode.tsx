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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { CommunicationSession } from "./communicationHelpers";
import {
  createSession,
  resetSession,
  sendSession,
  subscribeToSession,
  uploadOptionImage,
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
  const [optionImageUrls, setOptionImageUrls] = useState<string[]>(
    optionLabels.map(() => ""),
  );
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(
    null,
  );

  React.useEffect(() => {
    const unsub = subscribeToSession((s) => setFireSession(s), roomId);
    return () => unsub();
  }, [roomId]);

  React.useEffect(() => {
    setOptionImageUrls((currentUrls) =>
      optionLabels.map((_, index) => currentUrls[index] ?? ""),
    );
  }, [optionLabels]);
  React.useEffect(() => {
    setOptionImageUrls(optionLabels.map(() => ""));
  }, [templateVersion]);

  const draftSession = createSession(question, optionLabels, optionImageUrls);
  const currentSession = fireSession ?? sentSession ?? draftSession;
  const previewSession = draftSession;

  const selectedAnswer =
    currentSession && fireSession?.selectedAnswer
      ? (currentSession.options.find(
          (o) => o.id === fireSession.selectedAnswer,
        ) ?? null)
      : null;

  const isChildConnected = !!fireSession?.childFcmToken;
  const scrollRef = useRef<ScrollView | null>(null);
  const [optionRowPositions, setOptionRowPositions] = useState<number[]>([]);

  const scrollFieldIntoView = (index: number) => {
    const rowY = optionRowPositions[index];

    if (rowY === undefined || !scrollRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, rowY - 100),
        animated: true,
      });
    });
  };

  const setOptionImageUrl = (index: number, imageUrl: string) => {
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

  const handleRemoveImage = (index: number) => {
    setOptionImageUrl(index, "");
  };
  const isUploadingImage = uploadingImageIndex !== null;

  const showImageSourceMenu = (index: number) => {
    const hasImage = !!optionImageUrls[index];

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
              text: "Remove image",
              style: "destructive",
              onPress: () => handleRemoveImage(index),
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
    if (isUploadingImage) {
      Alert.alert(
        "Image still uploading",
        "Please wait until the image is ready before sending this session.",
      );
      return;
    }

    const session = createSession(question, optionLabels, optionImageUrls);

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
        ref={scrollRef}
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

        <View style={styles.parentStatusSection}>
          <Text style={styles.parentStatusLabel}>Child&apos;s response</Text>
          {selectedAnswer ? (
            <View style={styles.parentStatusActive}>
              <Text style={styles.parentStatusEmoji}>
                {selectedAnswer.emoji}
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
            {sentSession && <Text style={styles.parentSectionBadge}>Live</Text>}
          </View>

          <View style={styles.parentInputGroup}>
            <Text style={styles.parentInputLabel}>Quick templates</Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
            <View style={styles.parentOptionsList}>
              {optionLabels.map((label, index) => {
                const hasImage = !!optionImageUrls[index];
                const isUploading = uploadingImageIndex === index;

                return (
                  <View
                    key={`draft-${index}`}
                    onLayout={(event) => {
                      const rowY = event.nativeEvent.layout.y;
                      setOptionRowPositions((currentPositions) => {
                        const nextPositions = [...currentPositions];
                        nextPositions[index] = rowY;
                        return nextPositions;
                      });
                    }}
                    style={styles.parentOptionRow}
                  >
                    <View style={styles.parentOptionIndexBadge}>
                      <View style={styles.parentOptionIndexInner}>
                        <Text style={styles.parentOptionIndexText}>
                          {index + 1}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.parentOptionInputStack}>
                      <TextInput
                        accessibilityLabel={`Option ${index + 1} label`}
                        cursorColor="#A97E57"
                        placeholder={`Option ${index + 1}`}
                        placeholderTextColor="#D4C4B8"
                        selectionColor="#D8B48F"
                        style={styles.parentOptionInput}
                        value={label}
                        onChangeText={(value) =>
                          onOptionLabelChange(index, value)
                        }
                        onFocus={() => scrollFieldIntoView(index)}
                      />

                      <View style={styles.parentImageActionRow}>
                        <TouchableOpacity
                          style={styles.parentImageButton}
                          onPress={() => showImageSourceMenu(index)}
                          disabled={isUploading}
                        >
                          <Text style={styles.parentImageButtonText}>
                            {isUploading
                              ? "Uploading..."
                              : hasImage
                                ? "Change image"
                                : "Add image"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.parentImageStatusText}>
                        {hasImage
                          ? "Image ready"
                          : "Tap Add image to use camera or gallery. Emoji fallback will be used."}
                      </Text>
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
            disabled={isUploadingImage}
            style={[
              styles.primaryButton,
              isUploadingImage && styles.primaryButtonDisabled,
            ]}
            onPress={handleSend}
          >
            <Text style={styles.primaryButtonText}>
              {isUploadingImage ? "Uploading image..." : "Send to Child"}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

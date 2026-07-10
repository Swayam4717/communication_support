import React, { useState } from "react";
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FocusAlertModule from "../modules/focus-alert";
import { styles } from "./communicationCommon";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./communicationHelpers";
import * as Clipboard from "expo-clipboard";

interface DeviceSetupProps {
  onSetupComplete: (role: "parent" | "child", roomId: string) => void;
}

type SetupStage = "role-select" | "room-setup";
type ReadinessState = boolean | null;
const CHILD_BATTERY_ACK_KEY = "focusTestChildBatterySettingsAcknowledged";

const ROOM_WORDS = [
  "CALM",
  "BLUE",
  "STAR",
  "MOON",
  "RICE",
  "WAVE",
  "TREE",
  "SOFT",
];

function generateRoomCode() {
  const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
  const number = Math.floor(10000 + Math.random() * 90000);
  return `${word}-${number}`;
}

async function generateUniqueRoomCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateRoomCode();
    const roomSnap = await getDoc(doc(db, "rooms", code));

    if (!roomSnap.exists()) {
      return code;
    }
  }

  throw new Error("Failed to generate unique room code");
}

export default function DeviceSetupScreen({
  onSetupComplete,
}: DeviceSetupProps) {
  const [stage, setStage] = useState<SetupStage>("role-select");
  const [selectedRole, setSelectedRole] = useState<"parent" | "child" | null>(
    null,
  );
  const [roomCode, setRoomCode] = useState("");
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [useExistingRoom, setUseExistingRoom] = useState(false);
  const [childOverlayAllowed, setChildOverlayAllowed] =
    useState<ReadinessState>(null);
  const [childMicrophoneReady, setChildMicrophoneReady] =
    useState<ReadinessState>(null);
  const [childBatteryReady, setChildBatteryReady] =
    useState<ReadinessState>(null);
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);

  const checkChildBatterySettings = React.useCallback(async () => {
    if (Platform.OS !== "android") {
      setChildBatteryReady(true);
      return true;
    }

    try {
      const [isIgnoringBatteryOptimizations, acknowledged] =
        await Promise.all([
          FocusAlertModule.isIgnoringBatteryOptimizations(),
          AsyncStorage.getItem(CHILD_BATTERY_ACK_KEY),
        ]);
      const ready = Boolean(isIgnoringBatteryOptimizations) || acknowledged === "true";
      setChildBatteryReady(ready);
      return ready;
    } catch (error) {
      console.warn("Failed to check child battery settings:", error);
      const acknowledged = await AsyncStorage.getItem(CHILD_BATTERY_ACK_KEY);
      const ready = acknowledged === "true";
      setChildBatteryReady(ready);
      return ready;
    }
  }, []);

  const checkChildOverlayPermission = React.useCallback(async () => {
    
    if (Platform.OS !== "android") {
      setChildOverlayAllowed(true);
      return true;
    }

    try {
      const allowed = await FocusAlertModule.canDrawOverlays();
      setChildOverlayAllowed(Boolean(allowed));
      return Boolean(allowed);
    } catch (error) {
      console.warn("Failed to check child overlay permission:", error);
      setChildOverlayAllowed(false);
      return false;
    }
  }, []);

  React.useEffect(() => {
    if (selectedRole !== "child") {
      setChildOverlayAllowed(true);
      return;
    }

    checkChildOverlayPermission();
    checkChildBatterySettings();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkChildOverlayPermission();
        checkChildBatterySettings();
      }
    });

    return () => subscription.remove();
  }, [selectedRole, checkChildBatterySettings, checkChildOverlayPermission]);

  const handleRequestChildOverlayPermission = async () => {
    if (Platform.OS !== "android") {
      return;
    }

    try {
      await FocusAlertModule.requestOverlayPermission();
    } catch (error) {
      console.warn("Failed to open overlay permission settings:", error);
      Alert.alert(
        "Permission unavailable",
        "Could not open the overlay permission settings. Please enable Display over other apps manually from Android Settings.",
      );
    }
  };

  const checkChildMicrophonePermission = async () => {
    if (Platform.OS !== "android") {
      setChildMicrophoneReady(true);
      return true;
    }

    try {
      const permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      setChildMicrophoneReady(Boolean(permission.granted));
      return Boolean(permission.granted);
    } catch (error) {
      console.warn("Failed to check microphone permission:", error);
      setChildMicrophoneReady(false);
      return false;
    }
  };

  const handleRequestChildMicrophonePermission = async () => {
    try {
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setChildMicrophoneReady(Boolean(permission.granted));
    } catch (error) {
      console.warn("Failed to request microphone permission:", error);
      setChildMicrophoneReady(false);
      Alert.alert(
        "Permission unavailable",
        "Could not request microphone permission. The child can still tap an answer.",
      );
    }
  };

  const handleOpenBatterySettings = async () => {
    if (Platform.OS !== "android") {
      return;
    }

    try {
      const opened = await FocusAlertModule.openBatterySettings();

      if (!opened) {
        Alert.alert(
          "Settings unavailable",
          "Could not open app settings automatically. Please open Android Settings, find Focus-Test, then set Battery usage to unrestricted or allow background activity.",
        );
      }
    } catch (error) {
      console.warn("Failed to open battery settings:", error);
      Alert.alert(
        "Settings unavailable",
        "Could not open app settings automatically. Please open Android Settings, find Focus-Test, then set Battery usage to unrestricted or allow background activity.",
      );
    }
  };

  const handleAcknowledgeBatterySettings = async () => {
    await AsyncStorage.setItem(CHILD_BATTERY_ACK_KEY, "true");
    setChildBatteryReady(true);
  };

  const checkChildReadiness = React.useCallback(
    async (room = roomCode.trim().toUpperCase()) => {
      if (selectedRole !== "child") {
        return {
          overlayReady: true,
          microphoneReady: true,
        };
      }

      setIsCheckingReadiness(true);

      try {
        const [overlayReady, microphoneReady, batteryReady] = await Promise.all([
          checkChildOverlayPermission(),
          checkChildMicrophonePermission(),
          checkChildBatterySettings(),
        ]);

        return {
          roomReady: room.trim().toUpperCase()
            ? await checkChildRoomExists(room.trim().toUpperCase())
            : false,
          overlayReady,
          microphoneReady,
          batteryReady,
        };
      } finally {
        setIsCheckingReadiness(false);
      }
    },
    [checkChildBatterySettings, checkChildOverlayPermission, roomCode, selectedRole],
  );

  const handleContinueToRoom = async () => {
    if (!selectedRole) return;

    if (selectedRole === "parent") {
      setUseExistingRoom(false);

      try {
        const uniqueCode = await generateUniqueRoomCode();
        setRoomCode(uniqueCode);
      } catch (error) {
        console.warn("Failed to generate unique room code:", error);
        setRoomCode(generateRoomCode());
      }
    } else {
      setRoomCode("");
      setChildMicrophoneReady(null);
      setChildBatteryReady(null);
      checkChildOverlayPermission();
      checkChildMicrophonePermission();
      checkChildBatterySettings();
    }

    setStage("room-setup");
  };

  const handleRoomCodeChange = (value: string) => {
    setRoomCode(value.trim().toUpperCase());
  };
  const handleCopyRoomCode = async () => {
    const normalizedRoomCode = roomCode.trim().toUpperCase();

    if (!normalizedRoomCode) {
      Alert.alert("No room code", "There is no room code to copy.");
      return;
    }
    await Clipboard.setStringAsync(normalizedRoomCode);
    Alert.alert(
      "Room code copied",
      "The room code has been copied to clipboard.",
    );
  };

  const createParentRoomIfNeeded = async (normalizedRoomCode: string) => {
    const roomRef = doc(db, "rooms", normalizedRoomCode);

    await setDoc(
      roomRef,
      {
        id: "",
        type: "communication",
        title: "",
        options: [],
        status: "idle",
        selectedAnswer: null,
        createdAt: Date.now(),
        roomCreatedAt: Date.now(),
      },
      { merge: true },
    );
  };

  const checkChildRoomExists = async (normalizedRoomCode: string) => {
    const roomRef = doc(db, "rooms", normalizedRoomCode);
    const roomSnap = await getDoc(roomRef);
    return roomSnap.exists();
  };

  const handleCompleteSetup = async () => {
    const normalizedRoomCode = roomCode.trim().toUpperCase();

    if (!selectedRole || !normalizedRoomCode) {
      return;
    }

    setIsCheckingRoom(true);

    try {
      if (selectedRole === "parent") {
        if (useExistingRoom) {
          const existingRoom = await checkChildRoomExists(normalizedRoomCode);

          if (!existingRoom) {
            Alert.alert(
              "Room Not Found",
              "Please check the room code and try again.",
            );
            return;
          }
        } else {
          await createParentRoomIfNeeded(normalizedRoomCode);
        }

        onSetupComplete(selectedRole, normalizedRoomCode);
        return;
      }

      const readiness = await checkChildReadiness(normalizedRoomCode);

      if (!readiness.roomReady) {
        Alert.alert(
          "Room not found",
          "Please check the room code shown on the parent device and try again.",
        );
        return;
      }

      if (Platform.OS === "android" && !readiness.overlayReady) {
        Alert.alert(
          "Show alerts over other apps",
          "This is needed so parent messages can appear while the child is using another app.",
          [
            {
              text: "Enable alerts",
              onPress: handleRequestChildOverlayPermission,
            },
            {
              text: "Continue anyway",
              style: "cancel",
              onPress: () => onSetupComplete(selectedRole, normalizedRoomCode),
            },
          ],
        );
        return;
      }

      onSetupComplete(selectedRole, normalizedRoomCode);
    } catch (error) {
      console.warn("Room setup failed:", error);
      Alert.alert(
        "Setup failed",
        "Something went wrong while checking the room. Please try again.",
      );
    } finally {
      setIsCheckingRoom(false);
    }
  };

  const renderReadinessRow = ({
    title,
    description,
    ready,
    actionLabel,
    onAction,
  }: {
    title: string;
    description: string;
    ready: ReadinessState;
    actionLabel?: string;
    onAction?: () => void;
  }) => (
    <View style={styles.setupChecklistRow}>
      <View style={styles.setupChecklistTextWrap}>
        <Text style={styles.setupChecklistTitle}>{title}</Text>
        <Text style={styles.setupChecklistDescription}>
          {ready === null ? "Not checked yet." : ready ? "Ready" : description}
        </Text>
      </View>
      <Text
        style={[
          styles.setupChecklistStatus,
          ready ? styles.setupChecklistStatusReady : styles.setupChecklistStatusWarning,
        ]}
      >
        {ready ? "Ready" : "Needs setup"}
      </Text>
      {!ready && actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.setupChecklistAction}
          onPress={onAction}
        >
          <Text style={styles.setupChecklistActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderBatteryGuidanceRow = ({
    title,
    description,
    ready,
    onOpenSettings,
    onConfirm,
  }: {
    title: string;
    description: string;
    ready: ReadinessState;
    onOpenSettings: () => void;
    onConfirm: () => void;
  }) => (
    <View style={styles.setupChecklistRow}>
      <View style={styles.setupChecklistTextWrap}>
        <Text style={styles.setupChecklistTitle}>{title}</Text>
        <Text style={styles.setupChecklistDescription}>
          {ready ? "Marked done." : description}
        </Text>
      </View>
      <Text
        style={[
          styles.setupChecklistStatus,
          ready ? styles.setupChecklistStatusReady : styles.setupChecklistStatusWarning,
        ]}
      >
        {ready ? "Ready" : "Check settings"}
      </Text>
      {!ready ? (
        <>
          <TouchableOpacity
            style={styles.setupChecklistAction}
            onPress={onOpenSettings}
          >
            <Text style={styles.setupChecklistActionText}>
              Open app settings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.setupChecklistAction}
            onPress={onConfirm}
          >
            <Text style={styles.setupChecklistActionText}>
              I&apos;ve enabled this
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      style={styles.flexFill}
    >
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        styles.onboardingScrollContent,
        { paddingBottom: Platform.OS === "android" ? 160 : 80 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {stage === "role-select" ? (
        <View style={styles.setupContainer}>
          <View style={styles.setupHeroCard}>
            <Text style={styles.setupHeroEmoji}>⚙️</Text>
            <Text style={styles.setupHeroTitle}>Set up this device</Text>
            <Text style={styles.setupHeroSubtitle}>
              Choose how this device will be used
            </Text>
          </View>

          <View style={styles.roleButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === "parent" && styles.roleButtonSelected,
              ]}
              onPress={() => setSelectedRole("parent")}
            >
              <Text style={styles.roleButtonEmoji}>🧑‍🧒</Text>
              <Text style={styles.roleButtonTitle}>Parent Device</Text>
              <Text style={styles.roleButtonSubtitle}>
                Create and send sessions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === "child" && styles.roleButtonSelected,
              ]}
              onPress={() => {
                setSelectedRole("child");
                checkChildOverlayPermission();
              }}
            >
              <Text style={styles.roleButtonEmoji}>👦</Text>
              <Text style={styles.roleButtonTitle}>Child Device</Text>
              <Text style={styles.roleButtonSubtitle}>Answer with choices</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            disabled={!selectedRole}
            style={[
              styles.primaryButton,
              !selectedRole && styles.primaryButtonDisabled,
            ]}
            onPress={handleContinueToRoom}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {stage === "room-setup" ? (
        <View style={styles.setupContainer}>
          <View style={styles.setupHeroCard}>
            <Text style={styles.setupHeroEmoji}>🔑</Text>
            <Text style={styles.setupHeroTitle}>
              {selectedRole === "parent" ? "Your Room Code" : "Join Room"}
            </Text>
            <Text style={styles.setupHeroSubtitle}>
              {selectedRole === "parent"
                ? "Share this code with the child device"
                : "Enter the code shown on the parent device"}
            </Text>
          </View>

          {selectedRole === "child" ? (
            <View style={styles.setupChecklistCard}>
              <Text style={styles.sectionLabel}>Child setup checklist</Text>
              {renderReadinessRow({
                title: "Show alerts over other apps",
                description: "Needed so parent messages can appear while the child is using another app.",
                ready: childOverlayAllowed,
                actionLabel: "Enable alerts",
                onAction: handleRequestChildOverlayPermission,
              })}
              {renderBatteryGuidanceRow({
                title: "Background activity allowed",
                description: "Open App Info, then go to Battery usage and set Focus-Test to Unrestricted or Allow background activity.",
                ready: childBatteryReady,
                onOpenSettings: handleOpenBatterySettings,
                onConfirm: handleAcknowledgeBatterySettings,
              })}
              {renderReadinessRow({
                title: "Use microphone for speech practice",
                description: "Needed for Guided Speech Practice. The child can still tap an answer if this is off.",
                ready: childMicrophoneReady,
                actionLabel: "Enable microphone",
                onAction: handleRequestChildMicrophonePermission,
              })}
              <TouchableOpacity
                style={styles.setupChecklistRecheckButton}
                onPress={() => checkChildReadiness()}
                disabled={isCheckingReadiness}
              >
                <Text style={styles.setupChecklistActionText}>
                  {isCheckingReadiness
                    ? "Checking..."
                    : "Re-check permissions"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.panelCard}>
            <Text style={styles.sectionLabel}>Room Code</Text>
            {selectedRole === "parent" ? (
              <View style={{ marginBottom: 12, gap: 8 }}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={async () => {
                    setUseExistingRoom(false);

                    try {
                      const uniqueCode = await generateUniqueRoomCode();
                      setRoomCode(uniqueCode);
                    } catch (error) {
                      console.warn(
                        "Failed to generate unique room code:",
                        error,
                      );
                      setRoomCode(generateRoomCode());
                    }
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    Create New Room
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setUseExistingRoom(true);
                    setRoomCode("");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    Join Existing Room
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              cursorColor="#A97E57"
              editable={selectedRole === "child" || useExistingRoom}
              placeholder="Enter room code"
              placeholderTextColor="#AA9C94"
              selectionColor="#D8B48F"
              style={styles.textInput}
              value={roomCode}
              onChangeText={handleRoomCodeChange}
            />
            {selectedRole === "parent" && roomCode.trim() ? (
              <View style={styles.roomCodeActionRow}>
                <TouchableOpacity
                  style={styles.roomCodeCopyButton}
                  onPress={handleCopyRoomCode}
                >
                  <Text style={styles.roomCodeCopyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={styles.inputHint}>
              {selectedRole === "parent"
                ? "Use this same code on the child device."
                : "Ask the parent for their room code."}
            </Text>
          </View>

          <View style={styles.setupActionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setStage("role-select")}
              disabled={isCheckingRoom}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={
                isCheckingRoom ||
                isCheckingReadiness ||
                ((selectedRole === "child" || useExistingRoom) &&
                  !roomCode.trim())
              }
              style={[
                styles.primaryButton,
                (!roomCode.trim() || isCheckingRoom || isCheckingReadiness) &&
                  styles.primaryButtonDisabled,
              ]}
              onPress={handleCompleteSetup}
            >
              <Text style={styles.primaryButtonText}>
                {isCheckingRoom ? "Checking..." : "Set Up Device"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

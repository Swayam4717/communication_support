import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "./communicationCommon";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./communicationHelpers";

interface DeviceSetupProps {
  onSetupComplete: (role: "parent" | "child", roomId: string) => void;
}

type SetupStage = "role-select" | "room-setup";

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
    }

    setStage("room-setup");
  };

  const handleRoomCodeChange = (value: string) => {
    setRoomCode(value.trim().toUpperCase());
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
              "Please Check the room code and try again.",
            );
            return;
          }
        } else {
          await createParentRoomIfNeeded(normalizedRoomCode);
        }
        onSetupComplete(selectedRole, normalizedRoomCode);
        return;
      }

      const roomExists = await checkChildRoomExists(normalizedRoomCode);

      if (!roomExists) {
        Alert.alert(
          "Room not found",
          "Please check the room code shown on the parent device and try again.",
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

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
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
              onPress={() => setSelectedRole("child")}
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
              disabled={isCheckingRoom || ((selectedRole === "child" || useExistingRoom) && !roomCode.trim())}
              style={[
                styles.primaryButton,
                (!roomCode.trim() || isCheckingRoom) &&
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
  );
}

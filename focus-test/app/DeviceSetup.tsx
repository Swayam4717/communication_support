import React, { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { styles } from "./communicationCommon";

interface DeviceSetupProps {
  onSetupComplete: (role: "parent" | "child", roomId: string) => void;
}

type SetupStage = "role-select" | "room-setup";

export default function DeviceSetupScreen({ onSetupComplete }: DeviceSetupProps) {
  const [stage, setStage] = useState<SetupStage>("role-select");
  const [selectedRole, setSelectedRole] = useState<"parent" | "child" | null>(null);
  const [roomCode, setRoomCode] = useState("demo-room");

  const handleContinueToRoom = () => {
    if (selectedRole) {
      setStage("room-setup");
    }
  };

  const handleCompleteSetup = () => {
    if (selectedRole && roomCode.trim()) {
      onSetupComplete(selectedRole, roomCode.trim());
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
              <Text style={styles.roleButtonSubtitle}>
                Answer with choices
              </Text>
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
            <Text style={styles.setupHeroTitle}>Room Code</Text>
            <Text style={styles.setupHeroSubtitle}>
              {selectedRole === "parent"
                ? "This is your communication space"
                : "Enter the code from the parent device"}
            </Text>
          </View>

          <View style={styles.panelCard}>
            <Text style={styles.sectionLabel}>Room Code</Text>
            <TextInput
              cursorColor="#A97E57"
              placeholder="Enter room code"
              placeholderTextColor="#AA9C94"
              selectionColor="#D8B48F"
              style={styles.textInput}
              value={roomCode}
              onChangeText={setRoomCode}
            />
            <Text style={styles.inputHint}>
              {selectedRole === "parent"
                ? "Share this with the child device"
                : "Ask the parent device for this code"}
            </Text>
          </View>

          <View style={styles.setupActionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setStage("role-select")}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!roomCode.trim()}
              style={[
                styles.primaryButton,
                !roomCode.trim() && styles.primaryButtonDisabled,
              ]}
              onPress={handleCompleteSetup}
            >
              <Text style={styles.primaryButtonText}>Set Up Device</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

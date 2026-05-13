import React, {useState, useEffect} from "react";
import {ScrollView, Text, TextInput, TouchableOpacity, View} from "react-native";
import { styles } from "./communicationCommon";

interface DeviceSetupProps {
  onSetupComplete: (role: "parent" | "child", roomId: string) => void;
}

type SetupStage = "role-select" | "room-setup";
const ROOM_WORDS = ["CALM", "BLUE", "STAR", "MOON", "RICE", "WAVE", "TREE", "SOFT"]; 

function generateRoomCode() {
  const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
  const number = Math.floor(10000 + Math.random() * 90000); // 5 digit number, can be changed as the users increase
  return `${word}-${number}`;
}// 720000 possible combinations with current setup 


export default function DeviceSetupScreen({onSetupComplete}: DeviceSetupProps){
  const [stage, setStage] = useState<SetupStage>("role-select");
  const [selectedRole, setSelectedRole] = useState<"parent" | "child" | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const handleContinueToRoom = () => {
    if(!selectedRole)return;
    if(selectedRole === "parent"){
      setRoomCode(generateRoomCode());
    }else{
      setRoomCode("");
    }
    setStage("room-setup");
  };
  const handleRoomCodeChange = (value: string) => {
    setRoomCode(value.trim().toUpperCase());
  };
  const handleCompleteSetup =() =>{
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    if (selectedRole && normalizedRoomCode){
      onSetupComplete(selectedRole, normalizedRoomCode);
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

            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              cursorColor="#A97E57"
              editable={selectedRole === "child"}
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
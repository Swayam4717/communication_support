import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface ConfirmationScreenProps {
  selectedEmoji: string;
  selectedLabel: string;
  onDone: () => void;
}

/**
 * ConfirmationScreen - Final feedback screen
 * Shows user confirmation of their choice
 * Returns to intro screen on "Done"
 */
export function ConfirmationScreen({
  selectedEmoji,
  selectedLabel,
  onDone,
}: ConfirmationScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.mainText}>You chose: {selectedLabel}</Text>
      <Text style={styles.subtleText}>Your answer has been sent</Text>
      <Text style={styles.resultEmoji}>{selectedEmoji}</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
        <Text style={styles.primaryButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  mainText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1D2939",
    textAlign: "center",
    marginBottom: 12,
  },
  subtleText: {
    fontSize: 18,
    color: "#667085",
    textAlign: "center",
    marginBottom: 20,
  },
  resultEmoji: {
    fontSize: 80,
    marginVertical: 20,
  },
  primaryButton: {
    backgroundColor: "#2F80ED",
    paddingVertical: 20,
    paddingHorizontal: 60,
    borderRadius: 24,
    marginTop: 40,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "700",
  },
});

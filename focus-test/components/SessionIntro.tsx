import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface SessionIntroProps {
  title: string;
  subtitle: string;
  onStart: () => void;
  onToggleSession?: () => void;
  sessionName?: string;
}

/**
 * SessionIntro - Calm, reassuring first screen
 * Shows the user they're about to start a session
 * Includes optional toggle button for testing different sessions
 */
export function SessionIntro({
  title,
  subtitle,
  onStart,
  onToggleSession,
  sessionName,
}: SessionIntroProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.mainText}>{title}</Text>
      <Text style={styles.subtleText}>{subtitle}</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
        <Text style={styles.primaryButtonText}>Start</Text>
      </TouchableOpacity>

      {/* Optional toggle button for testing different sessions */}
      {onToggleSession && (
        <View style={styles.testingSection}>
          <Text style={styles.testingLabel}>Testing Session: {sessionName}</Text>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={onToggleSession}
          >
            <Text style={styles.toggleButtonText}>Switch Session</Text>
          </TouchableOpacity>
        </View>
      )}
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
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: "#2F80ED",
    paddingVertical: 20,
    paddingHorizontal: 60,
    borderRadius: 24,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "700",
  },
  testingSection: {
    marginTop: 60,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E4E7EC",
    paddingTop: 24,
  },
  testingLabel: {
    fontSize: 14,
    color: "#667085",
    marginBottom: 12,
  },
  toggleButton: {
    backgroundColor: "#E4E7EC",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  toggleButtonText: {
    color: "#1D2939",
    fontSize: 14,
    fontWeight: "600",
  },
});

import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import type { SessionOption } from "../types/session";

interface OptionCardProps {
  option: SessionOption;
  onPress: (option: SessionOption) => void;
}

/**
 * OptionCard - A single large, easy-to-tap choice option
 * Displays emoji + label in a calm, accessible format
 */
// Shared option card used by the older prototype screens.
export function OptionCard({ option, onPress }: OptionCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(option)}
      activeOpacity={0.8}
    >
      <Text style={styles.emoji}>{option.emoji}</Text>
      <Text style={styles.cardText}>{option.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 28,
    paddingVertical: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    // Increased touch target size for accessibility
    minHeight: 140,
    justifyContent: "center",
  },
  emoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1D2939",
  },
});

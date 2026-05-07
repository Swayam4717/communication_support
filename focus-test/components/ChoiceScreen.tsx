import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { OptionCard } from "./OptionCard";
import type { SessionOption } from "../types/session";

interface ChoiceScreenProps {
  question: string;
  options: SessionOption[];
  onOptionSelected: (option: SessionOption) => void;
}

/**
 * ChoiceScreen - Main interaction screen
 * Dynamically renders options from the session object
 * Displays question and provides multiple choice options
 */
export function ChoiceScreen({
  question,
  options,
  onOptionSelected,
}: ChoiceScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.mainText}>{question}</Text>

      <View style={styles.grid}>
        {options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            onPress={onOptionSelected}
          />
        ))}
      </View>
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
    marginBottom: 32,
  },
  grid: {
    width: "100%",
    gap: 18,
  },
});

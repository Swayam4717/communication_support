import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

type Screen = "incoming" | "options" | "done";

export default function ChildSessionScreen() {
  const [screen, setScreen] = useState<Screen>("incoming");
  const [selected, setSelected] = useState<string | null>(null);

  const foods = [
    { emoji: "🍕", label: "Pizza" },
    { emoji: "🍚", label: "Rice" },
    { emoji: "🍜", label: "Noodles" },
    { emoji: "🥪", label: "Sandwich" },
  ];

  if (screen === "incoming") {
    return (
      <View style={styles.container}>
        <Text style={styles.smallText}>Mom wants to ask you something</Text>
        <Text style={styles.bigText}>Are you ready?</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setScreen("options")}>
          <Text style={styles.primaryButtonText}>Start</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === "done") {
    return (
      <View style={styles.container}>
        <Text style={styles.bigText}>You chose</Text>
        <Text style={styles.resultEmoji}>{foods.find((f) => f.label === selected)?.emoji}</Text>
        <Text style={styles.resultText}>{selected}</Text>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            setSelected(null);
            setScreen("incoming");
          }}
        >
          <Text style={styles.secondaryButtonText}>New Session</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.smallText}>Mom asks:</Text>
      <Text style={styles.question}>What would you like to eat?</Text>

      <View style={styles.grid}>
        {foods.map((food) => (
          <TouchableOpacity
            key={food.label}
            style={styles.card}
            onPress={() => {
              setSelected(food.label);
              setScreen("done");
            }}
          >
            <Text style={styles.emoji}>{food.emoji}</Text>
            <Text style={styles.cardText}>{food.label}</Text>
          </TouchableOpacity>
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
  smallText: {
    fontSize: 20,
    color: "#667085",
    textAlign: "center",
    marginBottom: 16,
  },
  bigText: {
    fontSize: 34,
    fontWeight: "700",
    color: "#1D2939",
    textAlign: "center",
    marginBottom: 40,
  },
  question: {
    fontSize: 30,
    fontWeight: "700",
    color: "#1D2939",
    textAlign: "center",
    marginBottom: 32,
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
  secondaryButton: {
    backgroundColor: "#E4E7EC",
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 20,
    marginTop: 32,
  },
  secondaryButtonText: {
    color: "#1D2939",
    fontSize: 20,
    fontWeight: "600",
  },
  grid: {
    width: "100%",
    gap: 18,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 28,
    paddingVertical: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
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
  resultEmoji: {
    fontSize: 96,
    marginBottom: 16,
  },
  resultText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1D2939",
  },
});
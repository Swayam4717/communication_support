import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";

export default function HomeScreen() {
  const [selectedFood, setSelectedFood] = useState<string | null>(null);

  const foods = [
    { emoji: "🍕", name: "Pizza" },
    { emoji: "🍚", name: "Rice" },
    { emoji: "🍜", name: "Noodles" },
    { emoji: "🥪", name: "Sandwich" },
  ];

  if (selectedFood) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Great Choice!</Text>

        <Text style={styles.choiceEmoji}>
          {foods.find((f) => f.name === selectedFood)?.emoji}
        </Text>

        <Text style={styles.choiceText}>
          You selected {selectedFood}
        </Text>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => setSelectedFood(null)}
        >
          <Text style={styles.resetButtonText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>
        Mom wants to ask you something
      </Text>

      <Text style={styles.question}>
        What would you like to eat?
      </Text>

      <View style={styles.optionsContainer}>
        {foods.map((food) => (
          <TouchableOpacity
            key={food.name}
            style={styles.card}
            onPress={() => setSelectedFood(food.name)}
          >
            <Text style={styles.emoji}>{food.emoji}</Text>
            <Text style={styles.foodText}>{food.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  header: {
    fontSize: 20,
    color: "#5A6A85",
    marginBottom: 20,
    textAlign: "center",
  },

  question: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E2A3A",
    marginBottom: 40,
    textAlign: "center",
  },

  optionsContainer: {
    width: "100%",
    gap: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  emoji: {
    fontSize: 48,
    marginBottom: 10,
  },

  foodText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1E2A3A",
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1E2A3A",
    marginBottom: 30,
  },

  choiceEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },

  choiceText: {
    fontSize: 28,
    color: "#5A6A85",
    marginBottom: 40,
  },

  resetButton: {
    backgroundColor: "#4A90E2",
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
  },

  resetButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
});
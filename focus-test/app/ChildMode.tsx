import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import type { CommunicationSession } from "./communicationHelpers";
import { subscribeToSession, submitAnswer } from "./communicationHelpers";
import { Header, OptionCard } from "./communicationUI";
import { styles } from "./communicationCommon";

interface ChildModeScreenProps {
  roomId: string;
  onResetSetup: () => void;
}
/**
 * ChildModeScreen - Simulates the child's experience
 * Listens for incoming sessions and updates UI based on session status
 * Provides simple visual choices for the child to select and submit
 * 
 * Handles multiple stages: idle (no session), incoming (new session), choice (selecting an option), confirmation (answer sent)
 * Uses subscribeToSession to listen for session updates and submitAnswer to send the selected option back to the parent
 * Designed to be simple and calm, with clear prompts and feedback for the child user
 */
export default function ChildModeScreen({ roomId, onResetSetup }: ChildModeScreenProps) {
  // This screen mirrors the room document, steps through the child flow, and triggers the focus alert when a new session arrives.
  const [session, setSession] = React.useState<CommunicationSession | null>(null);
  const [stage, setStage] = React.useState<"idle" | "incoming" | "choice" | "confirmation">("idle");
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null);
// Subscribe to session updates for the given roomId and update local state accordingly
 React.useEffect(() => {
  const unsub = subscribeToSession((s) => {
    setSession(s);
// Update the child stage based on the current room status.
// Handle session status changes to update the UI stage and trigger alerts
    if (!s || s.status === "idle") {
      setStage("idle");
      setSelectedOptionId(null);
      return;
    }

    if (s.status === "sent") {
      setStage("incoming");
      return;
    }

    if (s.status === "answered") {
      setStage("confirmation");
    }
  }, roomId);

  return () => unsub();
}, [roomId]);

  const selectedOption = session?.options.find((o) => o.id === selectedOptionId) ?? null;
  React.useEffect(() => {
    console.log("CHILD SESSION OPTION:", JSON.stringify(session?.options, null, 2))
  }, [session]);
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Header title="Child Mode" subtitle={`Room: ${roomId}`} onBack={undefined} />

      <View style={styles.settingsButton}>
        <TouchableOpacity style={styles.resetButton} onPress={onResetSetup}>
          <Text style={styles.resetButtonText}>Reset Device Setup</Text>
        </TouchableOpacity>
      </View>

      {!session || stage === "idle" ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>☁️</Text>
          <Text style={styles.heroTitle}>No message right now</Text>
          <Text style={styles.heroSubtitle}>
            You can stay here until a new message arrives.
          </Text>
        </View>
      ) : null}

      {session && stage === "incoming" ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>📩</Text>
          <Text style={styles.heroTitle}>New message</Text>
          <Text style={styles.heroSubtitle}>You can answer when ready</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStage("choice")}>
            <Text style={styles.primaryButtonText}>Start</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "choice" ? (
        <View style={styles.choiceCard}>
          <Text style={styles.questionTitle}>{session.title}</Text>

          <View style={styles.choiceList}>
            {session.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={option.id === selectedOptionId}
                onPress={() => setSelectedOptionId(option.id)}
              />
            ))}
          </View>

          <TouchableOpacity
            disabled={!selectedOption}
            style={[
              styles.primaryButton,
              !selectedOption && styles.primaryButtonDisabled,
            ]}
            onPress={async () => {
              if (!selectedOption) return;
              try {
                await submitAnswer(selectedOption.id, roomId);
              } catch (e) {
                console.warn("submitAnswer failed", e);
              }
            }}
          >
            <Text style={styles.primaryButtonText}>Send Answer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "confirmation" && (session.selectedAnswer || selectedOption) ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>✓</Text>
          <Text style={styles.heroTitle}>Sent to Mum</Text>
          <Text style={styles.heroSubtitle}>
            You chose {session?.options.find((o) => o.id === session.selectedAnswer)?.label ?? selectedOption?.label}
          </Text>
          <Text style={styles.confirmationEmoji}>{session?.options.find((o) => o.id === session.selectedAnswer)?.emoji ?? selectedOption?.emoji}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => setStage("idle")}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}
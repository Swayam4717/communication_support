import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import type { SentSession, SessionOption, ChildStage } from "./communicationHelpers";
import { Header, OptionCard } from "./communicationUI";
import { styles } from "./communicationCommon";

interface ChildModeScreenProps {
  session: SentSession | null;
  stage: ChildStage;
  selectedOptionId: string | null;
  onStart: () => void;
  onSelectOption: (option: SessionOption) => void;
  onSendAnswer: () => void;
  onDone: () => void;
  onBackToSelect: () => void;
}

export default function ChildModeScreen({
  session,
  stage,
  selectedOptionId,
  onStart,
  onSelectOption,
  onSendAnswer,
  onDone,
  onBackToSelect,
}: ChildModeScreenProps) {
  const selectedOption =
    session?.options.find((option) => option.id === selectedOptionId) ?? null;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Header title="Child Mode" subtitle="Simple and calm" onBack={onBackToSelect} />

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
          <Text style={styles.heroTitle}>Mum wants to ask you something</Text>
          <Text style={styles.heroSubtitle}>You can answer when ready</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
            <Text style={styles.primaryButtonText}>Start</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "choice" ? (
        <View style={styles.choiceCard}>
          <Text style={styles.questionTitle}>{session.question}</Text>

          <View style={styles.choiceList}>
            {session.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={option.id === selectedOptionId}
                onPress={onSelectOption}
              />
            ))}
          </View>

          <TouchableOpacity
            disabled={!selectedOption}
            style={[
              styles.primaryButton,
              !selectedOption && styles.primaryButtonDisabled,
            ]}
            onPress={onSendAnswer}
          >
            <Text style={styles.primaryButtonText}>Send Answer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {session && stage === "confirmation" && selectedOption ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>✓</Text>
          <Text style={styles.heroTitle}>Sent to Mum</Text>
          <Text style={styles.heroSubtitle}>You chose {selectedOption.label}</Text>
          <Text style={styles.confirmationEmoji}>{selectedOption.emoji}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

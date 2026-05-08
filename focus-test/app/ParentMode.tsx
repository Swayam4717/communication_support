import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { SessionOption, CommunicationSession } from "./communicationHelpers";
import { createSession, sendSession, subscribeToSession, resetSession } from "./communicationHelpers";
import { OptionCard, Header } from "./communicationUI";
import { styles } from "./communicationCommon";

interface ParentModeScreenProps {
  question: string;
  optionLabels: string[];
  sentSession: CommunicationSession | null;
  showPreview: boolean;
  onQuestionChange: (value: string) => void;
  onOptionLabelChange: (index: number, value: string) => void;
  onPreviewToggle: () => void;
  onSendToChild: () => void;
  onBackToSelect: () => void;
}

export default function ParentModeScreen({
  question,
  optionLabels,
  sentSession,
  showPreview,
  onQuestionChange,
  onOptionLabelChange,
  onPreviewToggle,
  onSendToChild,
  onBackToSelect,
}: ParentModeScreenProps) {
  const [fireSession, setFireSession] = React.useState<CommunicationSession | null>(null);

  React.useEffect(() => {
    const unsub = subscribeToSession((s) => setFireSession(s));
    return () => unsub();
  }, []);

  const currentSession = fireSession ?? sentSession ?? createSession(question, optionLabels);
  const selectedAnswer = currentSession && fireSession?.selectedAnswer ? currentSession.options.find((o) => o.id === fireSession.selectedAnswer) ?? null : null;
  const parentStatusTitle = !sentSession ? "No session sent yet" : selectedAnswer ? `Child chose: ${selectedAnswer.label}` : "Waiting for child response";
  const scrollRef = useRef<ScrollView | null>(null);
  const [optionRowPositions, setOptionRowPositions] = useState<number[]>([]);

  const scrollFieldIntoView = (index: number) => {
    const rowY = optionRowPositions[index];

    if (rowY === undefined || !scrollRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, rowY - 100),
        animated: true,
      });
    });
  };

  const handleSend = async () => {
    const session = createSession(question, optionLabels);
    try {
      await sendSession(session);
      onSendToChild?.();
    } catch (e) {
      console.warn("sendSession failed", e);
    }
  };

  const handleReset = async () => {
    try {
      await resetSession();
      setFireSession(null);
    } catch (e) {
      console.warn("resetSession failed", e);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={8}
      style={styles.flexFill}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, styles.parentScrollContent]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <Header title="Parent Mode" subtitle="Build a gentle session" onBack={onBackToSelect} />

        <View style={styles.statusCard}>
          <Text style={styles.sectionLabel}>Session status</Text>
          <Text style={styles.statusTitle}>{parentStatusTitle}</Text>
          <Text style={styles.statusBody}>{currentSession.title}</Text>
          {selectedAnswer ? (
            <View style={styles.answerBadge}>
              <Text style={styles.answerBadgeEmoji}>{selectedAnswer.emoji}</Text>
              <Text style={styles.answerBadgeText}>{selectedAnswer.label}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.sectionLabel}>Question</Text>
          <TextInput
            accessibilityLabel="Question text"
            cursorColor="#A97E57"
            placeholder="What would you like to ask?"
            placeholderTextColor="#AA9C94"
            selectionColor="#D8B48F"
            style={styles.textInput}
            value={question}
            onChangeText={onQuestionChange}
            multiline
          />

          <Text style={[styles.sectionLabel, styles.optionsLabel]}>Options</Text>
          <View style={styles.parentOptionsList}>
            {optionLabels.map((label, index) => (
              <View
                key={`draft-${index}`}
                onLayout={(event) => {
                  const rowY = event.nativeEvent.layout.y;
                  setOptionRowPositions((currentPositions) => {
                    const nextPositions = [...currentPositions];
                    nextPositions[index] = rowY;
                    return nextPositions;
                  });
                }}
                style={styles.parentOptionRow}
              >
                <Text style={styles.parentOptionNumber}>{index + 1}</Text>
                <TextInput
                  accessibilityLabel={`Option ${index + 1} label`}
                  cursorColor="#A97E57"
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor="#AA9C94"
                  selectionColor="#D8B48F"
                  style={styles.optionInput}
                  value={label}
                  onChangeText={(value) => onOptionLabelChange(index, value)}
                  onFocus={() => scrollFieldIntoView(index)}
                />
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onPreviewToggle}>
              <Text style={styles.secondaryButtonText}>{showPreview ? "Hide preview" : "Preview Child Session"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSend}>
              <Text style={styles.primaryButtonText}>Send to Child</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 12 }}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
              <Text style={styles.secondaryButtonText}>Reset Session</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showPreview ? (
          <View style={styles.previewCard}>
            <Text style={styles.sectionLabel}>Child preview</Text>
            <Text style={styles.previewQuestion}>{currentSession.title}</Text>
            <View style={styles.previewGrid}>
              {currentSession.options.map((option) => (
                <OptionCard key={option.id} option={option} compact disabled />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

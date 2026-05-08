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
import type { SentSession, SessionOption } from "./communicationHelpers";
import { createSession } from "./communicationHelpers";
import { OptionCard, Header } from "./communicationUI";
import { styles } from "./communicationCommon";

interface ParentModeScreenProps {
  question: string;
  optionLabels: string[];
  sentSession: SentSession | null;
  childAnswer: SessionOption | null;
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
  childAnswer,
  showPreview,
  onQuestionChange,
  onOptionLabelChange,
  onPreviewToggle,
  onSendToChild,
  onBackToSelect,
}: ParentModeScreenProps) {
  const currentSession = sentSession ?? createSession(question, optionLabels);
  const parentStatusTitle = !sentSession
    ? "No session sent yet"
    : childAnswer
    ? `Child chose: ${childAnswer.label}`
    : "Waiting for child response";
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
          <Text style={styles.statusBody}>
            {sentSession ? sentSession.question : "Create a question and send it when you are ready."}
          </Text>
          {childAnswer ? (
            <View style={styles.answerBadge}>
              <Text style={styles.answerBadgeEmoji}>{childAnswer.emoji}</Text>
              <Text style={styles.answerBadgeText}>{childAnswer.label}</Text>
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

            <TouchableOpacity style={styles.primaryButton} onPress={onSendToChild}>
              <Text style={styles.primaryButtonText}>Send to Child</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showPreview ? (
          <View style={styles.previewCard}>
            <Text style={styles.sectionLabel}>Child preview</Text>
            <Text style={styles.previewQuestion}>{currentSession.question}</Text>
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

import React, { useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity } from "react-native";
import ParentModeScreen from "./ParentMode";
import ChildModeScreen from "./ChildMode";
import {
  DEFAULT_QUESTION,
  DEFAULT_OPTIONS,
  createSession,
  CommunicationSession,
} from "./communicationHelpers";
import { styles } from "./communicationCommon";

type AppMode = "select" | "parent" | "child";

interface ModeSelectScreenProps {
  onParentMode: () => void;
  onChildMode: () => void;
}

function ModeSelectScreen({ onParentMode, onChildMode }: ModeSelectScreenProps) {
  return (
    <View style={styles.modeSelectContainer}>
      <View style={styles.modeHeroCard}>
        <Text style={styles.modeHeroEmoji}>☁️</Text>
        <Text style={styles.modeHeroTitle}>Communication MVP</Text>
        <Text style={styles.modeHeroSubtitle}>Choose how you want to test the flow.</Text>
      </View>

      <TouchableOpacity style={styles.modeButton} onPress={onParentMode}>
        <Text style={styles.modeButtonEmoji}>🧑‍🧒</Text>
        <Text style={styles.modeButtonTitle}>Parent Mode</Text>
        <Text style={styles.modeButtonSubtitle}>Create a calm structured session</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.modeButton} onPress={onChildMode}>
        <Text style={styles.modeButtonEmoji}>👦</Text>
        <Text style={styles.modeButtonTitle}>Child Mode</Text>
        <Text style={styles.modeButtonSubtitle}>Answer with simple visual choices</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CommunicationMvpApp() {
  const [mode, setMode] = useState<AppMode>("select");
  const [draftQuestion, setDraftQuestion] = useState(DEFAULT_QUESTION);
  const [draftOptions, setDraftOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [showPreview, setShowPreview] = useState(false);
  const [sentSession, setSentSession] = useState<CommunicationSession | null>(null);

  const handleQuestionChange = (value: string) => setDraftQuestion(value);

  const handleOptionLabelChange = (index: number, value: string) => {
    setDraftOptions((currentOptions) => {
      const nextOptions = [...currentOptions];
      nextOptions[index] = value;
      return nextOptions;
    });
  };

  const handlePreviewToggle = () => setShowPreview((v) => !v);

  const handleSendToChild = () => {
    const nextSession = createSession(draftQuestion, draftOptions);

    setSentSession(nextSession);
    setShowPreview(false);
    setMode("parent");
  };

  // Child/parent realtime behavior handled inside ParentMode and ChildMode via Firestore subscriptions

  const handleBackToSelect = () => setMode("select");

  const renderCurrentMode = () => {
    if (mode === "parent") {
      return (
        <ParentModeScreen
          question={draftQuestion}
          optionLabels={draftOptions}
          sentSession={sentSession}
          showPreview={showPreview}
          onQuestionChange={handleQuestionChange}
          onOptionLabelChange={handleOptionLabelChange}
          onPreviewToggle={handlePreviewToggle}
          onSendToChild={handleSendToChild}
          onBackToSelect={handleBackToSelect}
        />
      );
    }

    if (mode === "child") {
      return (
        <ChildModeScreen onBackToSelect={handleBackToSelect} />
      );
    }

    return (
      <View style={styles.selectScreenWrapper}>
        <ModeSelectScreen
          onParentMode={() => setMode("parent")}
          onChildMode={() => setMode("child")}
        />
      </View>
    );
  };

  return <SafeAreaView style={styles.appShell}>{renderCurrentMode()}</SafeAreaView>;
}


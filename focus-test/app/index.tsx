import React, { useState } from "react";
import { SessionIntro } from "../components/SessionIntro";
import { ChoiceScreen } from "../components/ChoiceScreen";
import { ConfirmationScreen } from "../components/ConfirmationScreen";
import type { Session, SessionOption, ScreenState } from "../types/session";

/**
 * Sample Sessions - Reusable session objects
 * These define the flow, questions, and options for different communication scenarios
 */

// Food choice session
const FOOD_SESSION: Session = {
  id: "food",
  type: "choice",
  intro: {
    title: "Mom wants to ask you something",
    subtitle: "Take your time",
  },
  question: "What would you like to eat?",
  options: [
    { id: "1", label: "Pizza", emoji: "🍕" },
    { id: "2", label: "Rice", emoji: "🍚" },
    { id: "3", label: "Noodles", emoji: "🍜" },
    { id: "4", label: "Sandwich", emoji: "🥪" },
  ],
};

// Emotion check session
const EMOTION_SESSION: Session = {
  id: "emotion",
  type: "emotion",
  intro: {
    title: "How are you feeling today?",
    subtitle: "Take your time",
  },
  question: "How are you feeling?",
  options: [
    { id: "1", label: "Happy", emoji: "😀" },
    { id: "2", label: "Sad", emoji: "😔" },
    { id: "3", label: "Angry", emoji: "😡" },
    { id: "4", label: "Tired", emoji: "😴" },
  ],
};

/**
 * Main App Component
 * Orchestrates the session-based architecture
 * Manages screen flow and session switching for testing
 */
export default function ChildSessionScreen() {
  // Current screen in the flow
  const [screen, setScreen] = useState<ScreenState>("intro");

  // Currently active session
  const [activeSession, setActiveSession] = useState<Session>(FOOD_SESSION);

  // User's selected option
  const [selectedOption, setSelectedOption] = useState<SessionOption | null>(
    null
  );

  /**
   * Handle user pressing Start button
   * Transitions from intro to choice screen
   */
  const handleStartSession = () => {
    setScreen("choice");
  };

  /**
   * Handle user selecting an option
   * Stores selection and shows confirmation
   */
  const handleOptionSelect = (option: SessionOption) => {
    setSelectedOption(option);
    setScreen("confirmation");
  };

  /**
   * Handle user pressing Done on confirmation
   * Resets state and returns to intro for next session
   */
  const handleDone = () => {
    setSelectedOption(null);
    setScreen("intro");
  };

  /**
   * Toggle between food and emotion sessions
   * Useful for testing different session types
   */
  const handleToggleSession = () => {
    const newSession =
      activeSession.id === "food" ? EMOTION_SESSION : FOOD_SESSION;
    setActiveSession(newSession);
    setSelectedOption(null);
    setScreen("intro");
  };

  // Screen 1: Intro / Waiting screen
  if (screen === "intro") {
    return (
      <SessionIntro
        title={activeSession.intro.title}
        subtitle={activeSession.intro.subtitle}
        onStart={handleStartSession}
        onToggleSession={handleToggleSession}
        sessionName={activeSession.id}
      />
    );
  }

  // Screen 2: Choice screen (dynamic options from session)
  if (screen === "choice") {
    return (
      <ChoiceScreen
        question={activeSession.question}
        options={activeSession.options}
        onOptionSelected={handleOptionSelect}
      />
    );
  }

  // Screen 3: Confirmation screen
  if (screen === "confirmation" && selectedOption) {
    return (
      <ConfirmationScreen
        selectedEmoji={selectedOption.emoji}
        selectedLabel={selectedOption.label}
        onDone={handleDone}
      />
    );
  }

  // Fallback (should not reach here)
  return <SessionIntro title="Loading..." subtitle="" onStart={() => {}} />;
}
import React, { useEffect, useState } from "react";
import { SafeAreaView, Button } from "react-native";
import FocusAlert from "focus-alert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ParentModeScreen from "./ParentMode";
import ChildModeScreen from "./ChildMode";
import WelcomeScreen from "./WelcomeScreen";
import DeviceSetupScreen from "./DeviceSetup";
import {
  DEFAULT_QUESTION,
  DEFAULT_OPTIONS,
  createSession,
  CommunicationSession,
  DEFAULT_ROOM_ID,
} from "./communicationHelpers";
import { styles } from "./communicationCommon";
type AppState = "loading" | "welcome" | "setup" | "parent" | "child";

export default function CommunicationMvpApp() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [deviceRole, setDeviceRole] = useState<"parent" | "child" | null>(null);
  const [roomId, setRoomId] = useState<string>(DEFAULT_ROOM_ID);
  const [draftQuestion, setDraftQuestion] = useState(DEFAULT_QUESTION);
  const [draftOptions, setDraftOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [showPreview, setShowPreview] = useState(false);
  const [sentSession, setSentSession] = useState<CommunicationSession | null>(null);

  // Load persisted setup on app launch
  useEffect(() => {
    const loadSetup = async () => {
      try {
        const savedRole = await AsyncStorage.getItem("deviceRole");
        const savedRoomId = await AsyncStorage.getItem("roomId");

        if (savedRole && savedRoomId) {
          setDeviceRole(savedRole as "parent" | "child");
          setRoomId(savedRoomId);
          setAppState(savedRole === "parent" ? "parent" : "child");
        } else {
          setAppState("welcome");
        }
      } catch (error) {
        console.warn("Failed to load setup from AsyncStorage", error);
        setAppState("welcome");
      }
    };

    loadSetup();
  }, []);

  const handleProceedToSetup = () => {
    setAppState("setup");
  };

  const handleSetupComplete = async (role: "parent" | "child", room: string) => {
    try {
      await AsyncStorage.setItem("deviceRole", role);
      await AsyncStorage.setItem("roomId", room);
      setDeviceRole(role);
      setRoomId(room);
      setAppState(role === "parent" ? "parent" : "child");
    } catch (error) {
      console.warn("Failed to save setup to AsyncStorage", error);
    }
  };

  const handleResetSetup = async () => {
    try {
      await AsyncStorage.removeItem("deviceRole");
      await AsyncStorage.removeItem("roomId");
      setDeviceRole(null);
      setRoomId(DEFAULT_ROOM_ID);
      setAppState("welcome");
      setSentSession(null);
    } catch (error) {
      console.warn("Failed to reset setup", error);
    }
  };

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
  };

  if (appState === "loading") {
    return <SafeAreaView style={styles.appShell} />;
  }

  if (appState === "welcome") {
    return (
      <SafeAreaView style={styles.appShell}>
        <WelcomeScreen onGetStarted={handleProceedToSetup} />
      </SafeAreaView>
    );
  }

  if (appState === "setup") {
    return (
      <SafeAreaView style={styles.appShell}>
        <DeviceSetupScreen onSetupComplete={handleSetupComplete} />
      </SafeAreaView>
    );
  }

  if (appState === "parent" && deviceRole === "parent") {
    return (
      <SafeAreaView style={styles.appShell}>
        
        <ParentModeScreen
          question={draftQuestion}
          optionLabels={draftOptions}
          sentSession={sentSession}
          showPreview={showPreview}
          roomId={roomId}
          onQuestionChange={handleQuestionChange}
          onOptionLabelChange={handleOptionLabelChange}
          onPreviewToggle={handlePreviewToggle}
          onSendToChild={handleSendToChild}
          onResetSetup={handleResetSetup}
        />
        <Button
          title = "Test Native Notification"
          onPress={() => {
            console.log("Button Pressed")
            FocusAlert.showTestNotification();
          }}
          />
      </SafeAreaView>
    );
  }

  if (appState === "child" && deviceRole === "child") {
    return (
      <SafeAreaView style={styles.appShell}>
        <ChildModeScreen roomId={roomId} onResetSetup={handleResetSetup} />
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.appShell} />;
}


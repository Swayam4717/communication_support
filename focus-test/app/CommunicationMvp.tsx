import React, { useEffect, useState } from "react";
import { SafeAreaView, Button , Linking} from "react-native";
import FocusAlert from "focus-alert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ParentModeScreen from "./ParentMode";
import ChildModeScreen from "./ChildMode";
import WelcomeScreen from "./WelcomeScreen";
import DeviceSetupScreen from "./DeviceSetup";
import {doc , setDoc} from "firebase/firestore";


import {
  DEFAULT_QUESTION,
  DEFAULT_OPTIONS,
  createSession,
  CommunicationSession,
  DEFAULT_ROOM_ID,
  db,
} from "./communicationHelpers";
import { styles } from "./communicationCommon";
type AppState = "loading" | "welcome" | "setup" | "parent" | "child";
console.log("App Running");
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
  useEffect(() => {
  const handleUrl = (url: string) => {
    console.log("Deep link received:", url);

    if (url.includes("child-alert")) {
      setDeviceRole("child");
      setAppState("child");
    }
  };

  const subscription = Linking.addEventListener("url", (event) => {
    handleUrl(event.url);
  });

  Linking.getInitialURL().then((url) => {
    if (url) handleUrl(url);
  });

  return () => {
    subscription.remove();
  };
}, []);
  const handleProceedToSetup = () => {
    setAppState("setup");
  };

  const handleSetupComplete = async (role: "parent" | "child", room: string) => {
    try {
      console.log("Setup complete with role:", role, "and room:", room);
      await AsyncStorage.setItem("deviceRole", role);
      await AsyncStorage.setItem("roomId", room);
      //Register Child FCM
      if (role === "child") {
  try {
    console.log("CHILD TOKEN SAVE STARTED");

    const token = await FocusAlert.getFcmToken();

    console.log("TOKEN FROM NATIVE:", token);

    const roomRef = doc(db, "rooms", room);

    await setDoc(
      roomRef,
      {
        childFcmToken: token || "NO_TOKEN_RETURNED_TEST",
        tokenSavedAt: Date.now(),
      },
      { merge: true }
    );

    console.log("FIRESTORE TOKEN WRITE COMPLETE");
  } catch (tokenError) {
    console.warn("Failed to get or save FCM token", tokenError);
  }
}
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
          title= "Get FCM Token"
          onPress={() => {
            FocusAlert.getFcmToken();
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


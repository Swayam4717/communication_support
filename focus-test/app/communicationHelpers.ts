import { initializeApp } from "firebase/app";
import { doc, getFirestore, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

for (const [key, value] of Object.entries(firebaseConfig)) {
  if (!value) {
    throw new Error(`Missing required environment variable for Firebase config: ${key}`);
  }
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export type ChildStage = "idle" | "incoming" | "choice" | "confirmation";

export type SessionStatus = "idle" | "sent" | "answered";

export interface SessionOption {
  id: string;
  label: string;
  emoji?: string;
  imageUrl?: string;
}

export interface CommunicationSession {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  options: SessionOption[];
  status: SessionStatus;
  selectedAnswer?: string | null;
  createdAt: number;
}

export const ROOM_ID = "demo-room";

export const DEFAULT_QUESTION = "What would you like to eat?";
export const DEFAULT_OPTIONS = ["Rice", "Noodles", "Pizza", "Sandwich"];
export const FALLBACK_EMOJIS = ["🌿", "☁️", "✨", "🫧"];

export function getEmojiForLabel(label: string, index: number) {
  const normalized = label.trim().toLowerCase();
  const emojiMap: Record<string, string> = {
    rice: "🍚",
    noodles: "🍜",
    pizza: "🍕",
    sandwich: "🥪",
    happy: "😀",
    sad: "😔",
    angry: "😡",
    tired: "😴",
  };

  return emojiMap[normalized] ?? FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length];
}

export function buildSessionOptions(optionLabels: string[]): SessionOption[] {
  return optionLabels.map((label, index) => {
    const cleanedLabel = label.trim() || `Option ${index + 1}`;

    return {
      id: String(index + 1),
      label: cleanedLabel,
      emoji: getEmojiForLabel(cleanedLabel, index),
    };
  });
}

export function createSession(question: string, optionLabels: string[]): CommunicationSession {
  return {
    id: String(Date.now()),
    type: "communication",
    title: question.trim() || DEFAULT_QUESTION,
    options: buildSessionOptions(optionLabels),
    status: "sent",
    selectedAnswer: null,
    createdAt: Date.now(),
  } as CommunicationSession;
}

const roomsDoc = () => doc(db, "rooms", ROOM_ID);

export async function sendSession(session: CommunicationSession) {
  await setDoc(roomsDoc(), session);
}

export function subscribeToSession(
  cb: (session: CommunicationSession | null) => void
) {
  const unsub = onSnapshot(roomsDoc(), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const data = snap.data() as CommunicationSession;
    cb(data);
  });

  return unsub;
}

export async function submitAnswer(selectedAnswerId: string) {
  const d = roomsDoc();
  await updateDoc(d, {
    selectedAnswer: selectedAnswerId,
    status: "answered",
  });
}

export async function resetSession() {
  const empty: CommunicationSession = {
    id: "",
    type: "communication",
    title: "",
    options: [],
    status: "idle",
    selectedAnswer: null,
    createdAt: Date.now(),
  };

  await setDoc(roomsDoc(), empty);
}

import { initializeApp } from "firebase/app";
import { doc,getFirestore, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import {getFunctions, httpsCallable} from "firebase/functions";

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
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);


// Shared session types and helpers below define the Firestore room document used by both devices.

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
  childFcmToken?: string | null;
  tokenSavedAt?: number | null;
}

export const DEFAULT_ROOM_ID = "demo-room";

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

export function buildSessionOptions(
  optionLabels: string[],
  optionImageUrls: string[] = []
): SessionOption[] {
  return optionLabels.map((label, index) => {
    const cleanedLabel = label.trim() || `Option ${index + 1}`;
    const cleanedImageUrl = optionImageUrls[index]?.trim();

    return {
      id: String(index + 1),
      label: cleanedLabel,
      emoji: getEmojiForLabel(cleanedLabel, index),
      ...(cleanedImageUrl ? { imageUrl: cleanedImageUrl } : {}),
    };
  });
}

export function createSession(
  question: string,
  optionLabels: string[],
  optionImageUrls: string[] = []
): CommunicationSession {
  return {
    id: String(Date.now()),
    type: "communication",
    title: question.trim() || DEFAULT_QUESTION,
    options: buildSessionOptions(optionLabels, optionImageUrls),
    status: "sent",
    selectedAnswer: null,
    createdAt: Date.now(),
  } as CommunicationSession;
}

function getSafeRoomId(roomId: string) {
  return roomId.replace(/[^a-zA-Z0-9-_]/g, "_") || DEFAULT_ROOM_ID;
}

export async function uploadOptionImage(
  imageUri: string,
  roomId: string,
  optionIndex: number,
  mimeType?: string | null
) {
  const response = await fetch(imageUri);
  const imageBlob = await response.blob();

  const safeRoomId = getSafeRoomId(roomId);
  const extension = mimeType?.split("/")[1] || "jpg";
  const imagePath = `option-images/${safeRoomId}/${Date.now()}-option-${optionIndex + 1}.${extension}`;
  const imageRef = ref(storage, imagePath);

  await uploadBytes(imageRef, imageBlob, {
    contentType: mimeType || "image/jpeg",
  });

  return getDownloadURL(imageRef);
}

const getRoomsDoc = (roomId: string) => doc(db, "rooms", roomId);

// Each room is stored as a single Firestore document keyed by the shared room code.

export async function sendSession(session: CommunicationSession, roomId: string) {
  await setDoc(getRoomsDoc(roomId), session, { merge: true });
}

export function subscribeToSession(
  cb: (session: CommunicationSession | null) => void,
  roomId: string
) {
  const unsub = onSnapshot(getRoomsDoc(roomId), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const data = snap.data() as CommunicationSession;
    cb(data);
  });

  return unsub;
}

export async function submitAnswer(selectedAnswerId: string, roomId: string) {
  const d = getRoomsDoc(roomId);
  await updateDoc(d, {
    selectedAnswer: selectedAnswerId,
    status: "answered",
  });
}

export async function resetSession(roomId: string) {
  const empty: CommunicationSession = {
    id: "",
    type: "communication",
    title: "",
    options: [],
    status: "idle",
    selectedAnswer: null,
    createdAt: Date.now(),
  };

  await setDoc(getRoomsDoc(roomId), empty, { merge: true });
}
export async function generateOptionVisualsFromCloud(
  question: string,
  optionLabels: string[],
): Promise<string[]> {
  const generateOptionVisualsCallable = httpsCallable<
    { question: string; optionLabels: string[] },
    {
      question: string;
      images: Array<{
        label: string;
        imageUrl: string;
        source: string;
      }>;
    }
  >(functions, "generateOptionVisuals");

  const result = await generateOptionVisualsCallable({
    question,
    optionLabels,
  });
  return result.data.images.map((image) => image.imageUrl);
}
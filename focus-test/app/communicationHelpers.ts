import { initializeApp } from "firebase/app";
import { collection, doc, getDoc, getFirestore, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
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
  emoji?: string | null;
  imageUrl?: string | null;
  source?: string | null;
  provider?: string | null;
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
export interface SessionHistoryItem{
  id: string;
  question: string;
  options?: SessionOption[];
  answer: string;
  answerEmoji?: string;
  createdAt: number;
}
export const DEFAULT_ROOM_ID = "demo-room";

export const DEFAULT_QUESTION = "What would you like to eat?";
export const DEFAULT_OPTIONS = ["Rice", "Noodles", "Pizza", "Sandwich"];
const MAX_HISTORY_OPTIONS = 4;
const MAX_HISTORY_LABEL_LENGTH = 60;
const MAX_HISTORY_META_LENGTH = 80;
const MAX_HISTORY_IMAGE_URL_LENGTH = 2048;
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

function getSafeHistoryText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function getSafeHistoryImageUrl(value: unknown) {
  const imageUrl = getSafeHistoryText(value, MAX_HISTORY_IMAGE_URL_LENGTH);

  if (!/^https?:\/\//i.test(imageUrl)) {
    return "";
  }

  return imageUrl;
}

function sanitizeHistoryOptions(options: SessionOption[]) {
  return options.slice(0, MAX_HISTORY_OPTIONS).reduce<SessionOption[]>(
    (safeOptions, option, index) => {
      const label = getSafeHistoryText(
        option.label,
        MAX_HISTORY_LABEL_LENGTH,
      );

      if (!label) {
        return safeOptions;
      }

      const emoji = getSafeHistoryText(option.emoji, MAX_HISTORY_META_LENGTH);
      const imageUrl = getSafeHistoryImageUrl(option.imageUrl);
      const source = getSafeHistoryText(option.source, MAX_HISTORY_META_LENGTH);
      const provider = getSafeHistoryText(
        option.provider,
        MAX_HISTORY_META_LENGTH,
      );

      safeOptions.push({
        id:
          getSafeHistoryText(option.id, MAX_HISTORY_META_LENGTH) ||
          String(index + 1),
        label,
        ...(emoji ? { emoji } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(source ? { source } : {}),
        ...(provider ? { provider } : {}),
      });

      return safeOptions;
    },
    [],
  );
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

export function createSessionWithResolvedOptions(
  question: string,
  options: SessionOption[],
): CommunicationSession {
  return {
    id: String(Date.now()),
    type: "communication",
    title: question.trim() || DEFAULT_QUESTION,
    options,
    status: "sent",
    selectedAnswer: null,
    createdAt: Date.now(),
  };
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
const getRoomHistoryCollection = (roomId: string) => collection(db, "rooms", roomId, "history");
// Each room is stored as a single Firestore document keyed by the shared room code.

export async function sendSession(session: CommunicationSession, roomId: string) {
  await setDoc(getRoomsDoc(roomId), session, { merge: true });
}

export async function getCurrentSession(roomId: string) {
  const snap = await getDoc(getRoomsDoc(roomId));

  if (!snap.exists()) {
    return null;
  }

  return snap.data() as CommunicationSession;
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
): Promise<SessionOption[]> {
  const generateOptionVisualsCallable = httpsCallable<
    { question: string; optionLabels: string[] },
    {
      question: string;
      images: Array<{
        label: string;
        imageUrl?: string | null;
        emoji?: string | null;
        source?: string | null;
        provider?: string | null;
        debug?: unknown;
      }>;
    }
  >(functions, "generateOptionVisuals");

  const result = await generateOptionVisualsCallable({
    question,
    optionLabels,
  });
  return result.data.images.map((image, index) => {
    const cleanedLabel =
      image.label?.trim() || optionLabels[index]?.trim() || `Option ${index + 1}`;

    return {
      id: String(index + 1),
      label: cleanedLabel,
      imageUrl: image.imageUrl ?? null,
      emoji: image.emoji ?? getEmojiForLabel(cleanedLabel, index),
      source: image.source ?? null,
      provider: image.provider ?? null,
    };
  });
}
export async function saveSessionHistory(
  session: CommunicationSession,
  roomId: string,
) {
  if (!session.selectedAnswer) {
    return;
  }

  const selectedOption = session.options.find(
    (option) => option.id === session.selectedAnswer,
  );

  if (!selectedOption) {
    return;
  }

  const historyItem: SessionHistoryItem = {
    id: session.id || String(Date.now()),
    question: session.title,
    options: sanitizeHistoryOptions(session.options),
    answer: selectedOption.label,
    answerEmoji: selectedOption.emoji ?? undefined,
    createdAt: Date.now(),
  };

  await setDoc(
    doc(getRoomHistoryCollection(roomId), historyItem.id),
    historyItem,
    { merge: true },
  );
}

export function subscribeToSessionHistory(
  cb: (history: SessionHistoryItem[]) => void,
  roomId: string,
) {
  const q = query(
    getRoomHistoryCollection(roomId),
    orderBy("createdAt", "desc"),
    limit(10),
  );

  return onSnapshot(q, (snap) => {
    const history = snap.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Omit<SessionHistoryItem, "id">),
    }));

    cb(history);
  });
}

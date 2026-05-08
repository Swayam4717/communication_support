export type ChildStage = "idle" | "incoming" | "choice" | "confirmation";

export interface SessionOption {
  id: string;
  label: string;
  emoji: string;
}

export interface SentSession {
  id: string;
  question: string;
  options: SessionOption[];
  createdAt: number;
}

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

export function createSession(question: string, optionLabels: string[]) {
  return {
    id: String(Date.now()),
    question: question.trim() || DEFAULT_QUESTION,
    options: buildSessionOptions(optionLabels),
    createdAt: Date.now(),
  } as SentSession;
}

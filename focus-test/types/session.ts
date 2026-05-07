/**
 * Session object structure for defining multi-screen communication flows
 */

export interface SessionOption {
  id: string;
  label: string;
  emoji: string;
}

export interface Session {
  id: string;
  type: "choice" | "emotion" | "custom";
  intro: {
    title: string;
    subtitle: string;
  };
  question: string;
  options: SessionOption[];
}

export type ScreenState = "intro" | "choice" | "confirmation";

import type { StyleProp, ViewStyle } from 'react-native';

// Type definitions for the local module's JS API and native view props.

export type OnLoadEventPayload = {
  url: string;
};

export type FocusAlertModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
  androidSpeechReady: (params: AndroidSpeechReadyPayload) => void;
  androidSpeechBeginning: (params: AndroidSpeechBeginningPayload) => void;
  androidSpeechPartialResult: (params: AndroidSpeechResultPayload) => void;
  androidSpeechFinalResult: (params: AndroidSpeechResultPayload) => void;
  androidSpeechError: (params: AndroidSpeechErrorPayload) => void;
  androidSpeechEnd: (params: AndroidSpeechEndPayload) => void;
};

export type ChangeEventPayload = {
  value: string;
};

export type AndroidSpeechReadyPayload = {
  ready?: boolean;
};

export type AndroidSpeechBeginningPayload = {
  started?: boolean;
};

export type AndroidSpeechResultPayload = {
  transcript: string;
  results?: string[];
};

export type AndroidSpeechErrorPayload = {
  message?: string;
  code?: number;
};

export type AndroidSpeechEndPayload = {
  ended?: boolean;
};

export type FocusAlertViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};

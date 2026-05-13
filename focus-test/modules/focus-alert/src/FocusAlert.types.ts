import type { StyleProp, ViewStyle } from 'react-native';

// Type definitions for the local module's JS API and native view props.

export type OnLoadEventPayload = {
  url: string;
};

export type FocusAlertModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
};

export type ChangeEventPayload = {
  value: string;
};

export type FocusAlertViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};

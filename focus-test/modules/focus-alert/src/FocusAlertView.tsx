import { requireNativeView } from 'expo';
import * as React from 'react';

import { FocusAlertViewProps } from './FocusAlert.types';

const NativeView: React.ComponentType<FocusAlertViewProps> =
  requireNativeView('FocusAlert');

// Thin wrapper around the native view export for the local module.

export default function FocusAlertView(props: FocusAlertViewProps) {
  return <NativeView {...props} />;
}

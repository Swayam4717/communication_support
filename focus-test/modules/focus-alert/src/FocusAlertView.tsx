import { requireNativeView } from 'expo';
import * as React from 'react';

import { FocusAlertViewProps } from './FocusAlert.types';

const NativeView: React.ComponentType<FocusAlertViewProps> =
  requireNativeView('FocusAlert');

export default function FocusAlertView(props: FocusAlertViewProps) {
  return <NativeView {...props} />;
}

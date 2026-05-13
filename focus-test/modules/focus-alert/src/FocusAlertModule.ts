import { NativeModule, requireNativeModule } from 'expo';

import { FocusAlertModuleEvents } from './FocusAlert.types';

// JS-facing native module contract for alert permissions, notifications, and token access.

declare class FocusAlertModule extends NativeModule<FocusAlertModuleEvents> {
  showTestNotification():void;
  canDrawOverlays(): boolean;
  requestOverlayPermission(): void;
  showOverlayAlert(): void;
  triggerFocusAlert(): void;
  getFcmToken(): string;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<FocusAlertModule>('FocusAlert');

import { NativeModule, requireNativeModule } from 'expo';

import { FocusAlertModuleEvents } from './FocusAlert.types';

declare class FocusAlertModule extends NativeModule<FocusAlertModuleEvents> {
  showTestNotification():void;
  canDrawOverlays(): boolean;
  requestOverlayPermission(): void;
  showOverlayAlert(): void;
  triggerFocusAlert(): void;

}

// This call loads the native module object from the JSI.
export default requireNativeModule<FocusAlertModule>('FocusAlert');

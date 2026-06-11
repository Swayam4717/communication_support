import { registerWebModule, NativeModule } from 'expo';

import { FocusAlertModuleEvents } from './FocusAlert.types';

class FocusAlertModule extends NativeModule<FocusAlertModuleEvents> {
  PI = Math.PI;

  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }

  hello() {
    return 'Hello world!';
  }

  showTestNotification() {}

  canDrawOverlays() {
    return true;
  }

  requestOverlayPermission() {}

  isIgnoringBatteryOptimizations() {
    return true;
  }

  openBatterySettings() {
    return false;
  }

  showOverlayAlert() {}

  triggerFocusAlert() {}

  getFcmToken() {
    return null;
  }
}

export default registerWebModule(FocusAlertModule, 'FocusAlertModule');

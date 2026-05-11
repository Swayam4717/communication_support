import { registerWebModule, NativeModule } from 'expo';

import { FocusAlertModuleEvents } from './FocusAlert.types';

class FocusAlertModule extends NativeModule<FocusAlertModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(FocusAlertModule, 'FocusAlertModule');

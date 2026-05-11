// Reexport the native module. On web, it will be resolved to FocusAlertModule.web.ts
// and on native platforms to FocusAlertModule.ts
export { default } from './FocusAlertModule';
export { default as FocusAlertView } from './FocusAlertView';
export * from  './FocusAlert.types';

import { Stack } from "expo-router";

// Root router for the app; the app uses custom full-screen flows instead of the default header.

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
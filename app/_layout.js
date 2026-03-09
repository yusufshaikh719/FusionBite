import { Stack } from 'expo-router';
import { AlertProvider } from './AlertContext';

export default function Layout() {
  return (
    <AlertProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </AlertProvider>
  );
}
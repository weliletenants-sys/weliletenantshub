import { useEffect } from 'react';
import { useInstallReminder } from '@/hooks/useInstallReminder';

/**
 * Provider component that initializes install reminder system
 * Separated to avoid blocking main app render
 */
export const InstallReminderProvider = () => {
  useInstallReminder();
  return null;
};

/**
 * Haptic feedback utilities for mobile devices
 * Uses the Vibration API to provide tactile feedback
 */

export const haptics = {
  /**
   * Light tap feedback - for button presses and interactions
   */
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium feedback - for confirmations and selections
   */
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },

  /**
   * Heavy feedback - for important actions and alerts
   */
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(40);
    }
  },

  /**
   * Success pattern - for successful operations
   */
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }
  },

  /**
   * Error pattern - for errors and warnings
   */
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 100, 20, 100, 20]);
    }
  },

  /**
   * Refresh pattern - for pull-to-refresh action
   */
  refresh: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 30, 15]);
    }
  },
};

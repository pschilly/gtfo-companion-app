import { invoke } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { isTauriRuntime } from './tauriBridge';
import { WindowPreferences } from '../types';

/**
 * Checks and requests desktop OS notification permission.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (isTauriRuntime()) {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      return granted;
    } catch (err) {
      console.warn('Failed to check/request Tauri notification permission:', err);
      return false;
    }
  }

  // Web API fallback
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
  }

  return false;
}

/**
 * Sends a desktop OS toast notification.
 */
export async function dispatchDesktopToast(title: string, body: string): Promise<boolean> {
  try {
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) {
      console.log('Desktop notification skipped: permission not granted.');
      return false;
    }

    if (isTauriRuntime()) {
      sendNotification({
        title,
        body,
      });
      return true;
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
      return true;
    }
  } catch (error) {
    console.error('Failed to dispatch desktop toast notification:', error);
  }
  return false;
}

/**
 * Fetches window minimization and tray preferences from Rust backend.
 */
export async function getWindowPreferencesCommand(): Promise<WindowPreferences> {
  if (isTauriRuntime()) {
    return await invoke<WindowPreferences>('get_window_preferences');
  }
  return {
    startMinimized: false,
    minimizeToTray: true,
    closeToTray: true,
  };
}

/**
 * Persists window minimization and tray preferences to Rust backend.
 */
export async function setWindowPreferencesCommand(preferences: WindowPreferences): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('set_window_preferences', { preferences });
  }
}

/**
 * Brings main window to the foreground and unminimizes.
 */
export async function showMainWindowCommand(): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('show_main_window');
  }
}

/**
 * Minimizes main window (to tray or taskbar depending on preferences).
 */
export async function minimizeMainWindowCommand(): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('minimize_main_window');
  }
}

/**
 * Hides main window to tray.
 */
export async function hideMainWindowCommand(): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('hide_main_window');
  }
}

/**
 * Updates the tray icon with a visual notification badge dot, dynamic tooltip, and context menu.
 */
export async function updateTrayNotificationBadgeCommand(unreadCount: number): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await invoke('update_tray_notification_badge', { unreadCount });
    } catch (err) {
      console.warn('Failed to update system tray notification badge:', err);
    }
  }
}


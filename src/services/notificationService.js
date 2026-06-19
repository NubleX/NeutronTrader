// NeutronTrader - Notification prefs IPC service wrapper

const isElectronAvailable = () =>
  typeof window !== 'undefined' && window.electronAPI;

export async function getNotificationPrefs() {
  if (!isElectronAvailable()) return null;
  const result = await window.electronAPI.notification.getPrefs();
  return result?.data || null;
}

export async function updateNotificationPrefs(prefs) {
  if (!isElectronAvailable()) return null;
  const result = await window.electronAPI.notification.updatePrefs(prefs);
  return result?.data || null;
}

export async function testNotification() {
  if (!isElectronAvailable()) return false;
  const result = await window.electronAPI.notification.test();
  return result?.success;
}

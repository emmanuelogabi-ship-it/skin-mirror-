import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Stable ids so we can replace rather than stack up duplicate reminders.
const AM_ID = 'skin-mirror-am-reminder';
const PM_ID = 'skin-mirror-pm-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

async function scheduleDaily(id: string, hour: number, minute: number, title: string, body: string) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

/** Sync the two daily reminders to the user's current on/off preference. Safe to call often. */
export async function syncReminders(amEnabled: boolean, pmEnabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;

  if (amEnabled) {
    await scheduleDaily(AM_ID, 8, 0, 'Morning skin routine', 'A couple of minutes now sets the tone for the day.');
  } else {
    await Notifications.cancelScheduledNotificationAsync(AM_ID).catch(() => {});
  }

  if (pmEnabled) {
    await scheduleDaily(PM_ID, 21, 0, 'Evening skin routine', 'Wind down with tonight’s steps before bed.');
  } else {
    await Notifications.cancelScheduledNotificationAsync(PM_ID).catch(() => {});
  }
}

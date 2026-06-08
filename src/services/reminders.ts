import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { Reminder } from "@/types/domain";

const CHANNEL_ID = "dayrange-reminders";

export async function cancelReminderNotification(notificationId: string | null): Promise<void> {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}

export async function scheduleReminderNotification(reminder: Reminder): Promise<string> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "DayRange reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === "granted" ? current : await Notifications.requestPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Scheduled glucose reminder",
      body: reminder.label,
      data: { url: "/", reminderId: reminder.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminder.hour,
      minute: reminder.minute,
      channelId: CHANNEL_ID,
    },
  });
}

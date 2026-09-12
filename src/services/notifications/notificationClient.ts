import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type NotificationPermissionState = "granted" | "denied" | "undetermined";

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionState> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return "granted";
    }
    if (settings.canAskAgain) {
      return "undetermined";
    }
    return "denied";
  } catch (err) {
    console.warn("Error reading notification permission", err);
    return "undetermined";
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("stride-default", {
        name: "Stride Daily Rhythms",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#8B9EFF",
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (err) {
    console.warn("Error requesting notification permission", err);
    return false;
  }
}

export type ScheduleReminderOptions = {
  title: string;
  body: string;
  triggerSecondsFromNow: number;
};

export async function scheduleLocalReminder(options: ScheduleReminderOptions): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.floor(options.triggerSecondsFromNow)),
        repeats: false,
      },
    });
    return id;
  } catch (err) {
    console.warn("Failed to schedule local notification", err);
    // Honest plumbing: do not fake scheduling success if it failed
    return null;
  }
}

// TODO: Hook point for smart/contextual notifications based on user rhythm and upcoming deadlines
export async function scheduleRhythmBriefing(_userDayStart: string): Promise<void> {
  // TODO: calculate optimal morning briefing trigger time
}

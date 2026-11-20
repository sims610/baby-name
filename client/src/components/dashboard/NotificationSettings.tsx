import Notice from "@/components/common/Notice";
import type { PushState } from "@/notifications/push";
import { usePushNotifications } from "@/notifications/usePushNotifications";
import "./NotificationSettings.css";

/** Why the switch can't be used here, if it can't. */
const unavailable: Partial<Record<PushState, string>> = {
  needsInstall:
    "Match alerts work in the LittleRoots app. Install it from your browser's menu (on iPhone and iPad: Share → Add to Home Screen), then open it from your home screen.",
  unsupported: "This device can't show notifications from LittleRoots.",
  denied: "Notifications are blocked for LittleRoots. Allow them in your device's settings, then come back.",
};

/** Switch for "notify me when my partner likes a name I like", on this device. */
export default function NotificationSettings() {
  const { state, busy, error, enable, disable } = usePushNotifications();
  const on = state === "subscribed";
  const reason = state ? unavailable[state] : undefined;

  return (
    <section className="notify" aria-labelledby="notify-title">
      <div className="notify-row">
        <div className="notify-text">
          <h2 id="notify-title">Notifications</h2>
          <p id="notify-description">
            Get a notification on this device when your partner likes a name you already love.
          </p>
        </div>
        <label className="notify-switch theme-default">
          <input
            type="checkbox"
            role="switch"
            checked={on}
            disabled={state === null || busy || reason !== undefined}
            aria-describedby="notify-description"
            onChange={() => void (on ? disable() : enable())}
          />
          <span className="notify-switch-track" aria-hidden="true" />
          <span className="notify-switch-label">Match alerts</span>
        </label>
      </div>

      {reason && (
        <div className="notify-message">
          <Notice variant="info">{reason}</Notice>
        </div>
      )}
      {error && (
        <div className="notify-message">
          <Notice variant="error">{error}</Notice>
        </div>
      )}
    </section>
  );
}

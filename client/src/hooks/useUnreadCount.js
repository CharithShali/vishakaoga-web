import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';

const NOTIFICATIONS_CHANGED = 'oga:notifications-changed';
const EVERY_MINUTE = 60 * 1000;

// Tell the bell to refresh now (e.g. after opening the notifications page).
export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

// Unread notifications for the logged-in member. Refreshes on page change,
// every minute, and when announceNotificationsChanged() runs.
export function useUnreadCount(user) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  const loggedIn = Boolean(user);

  const refresh = useCallback(() => {
    if (!loggedIn) return;
    api('/notifications/unread-count')
      .then((d) => setCount(d.count))
      .catch(() => {});
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) {
      setCount(0);
      return undefined;
    }
    refresh();
    const timer = setInterval(refresh, EVERY_MINUTE);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [loggedIn, refresh, location.pathname]);

  return count;
}

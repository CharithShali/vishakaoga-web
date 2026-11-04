import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { hasRole } from '../auth/permissions.js';

export const PENDING_CHANGED = 'oga:pending-changed';
const REVIEW_ROLES = ['coordinator', 'secretary'];
const EVERY_MINUTE = 60 * 1000;

// Tell the header badge to refresh now (e.g. right after approving someone).
export function announcePendingChanged() {
  window.dispatchEvent(new Event(PENDING_CHANGED));
}

// How many registrations are waiting for this committee member.
// Refreshes on page change, every minute, and when announcePendingChanged() runs.
export function usePendingCount(user) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  const canReview = hasRole(user, REVIEW_ROLES);

  const refresh = useCallback(() => {
    if (!canReview) return;
    api('/registrations/count')
      .then((d) => setCount(d.count))
      .catch(() => {});
  }, [canReview]);

  useEffect(() => {
    if (!canReview) {
      setCount(0);
      return undefined;
    }
    refresh();
    const timer = setInterval(refresh, EVERY_MINUTE);
    window.addEventListener(PENDING_CHANGED, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(PENDING_CHANGED, refresh);
    };
  }, [canReview, refresh, location.pathname]);

  return count;
}

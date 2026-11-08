import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { announceNotificationsChanged } from '../hooks/useUnreadCount.js';

const dateTime = (d) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d));

export default function NotificationsPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const loaded = useRef(false); // React runs effects twice in development; load once

  // Show them, then mark them all as read (the unread ones stay highlighted on this visit).
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api('/notifications')
      .then(async (d) => {
        setItems(d.notifications);
        if (d.notifications.some((n) => !n.readAt)) {
          await api('/notifications/read-all', { method: 'POST' });
          announceNotificationsChanged();
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="container page alert alert-error">{error}</p>;
  if (!items) return <p className="container page muted">Loading…</p>;

  return (
    <div className="container page narrow-wide">
      <h1>Notifications</h1>
      {items.length === 0 && <p className="card muted">No notifications yet.</p>}
      <ul className="notification-list">
        {items.map((n) => (
          <li key={n._id} className={n.readAt ? 'card notification' : 'card notification unread'}>
            <div className="notification-head">
              <h2>{n.title}</h2>
              {!n.readAt && <span className="pill pill-gold">New</span>}
            </div>
            {n.body && <p>{n.body}</p>}
            <div className="row-actions">
              <span className="muted small">
                {dateTime(n.createdAt)}{n.createdBy?.fullName ? ` · from ${n.createdBy.fullName}` : ''}
              </span>
              {n.link && <Link to={n.link} className="btn btn-small">Open</Link>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

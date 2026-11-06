import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { hasRole, MANAGE_EVENT_ROLES } from '../auth/permissions.js';
import AttendButton from '../components/AttendButton.jsx';
import { dateParts, timeRange } from '../utils/time.js';

export default function EventsPage() {
  const { user } = useAuth();
  const [when, setWhen] = useState('upcoming');
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ when });
    if (branch) params.set('branch', branch);
    api(`/events?${params}`)
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [when, branch, user]);

  function update(id, changes) {
    setEvents((list) => list.map((e) => (e._id === id ? { ...e, ...changes } : e)));
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p className="muted">
            Events at your branch and joint events for all three cities. Your QR card works at every one.
          </p>
        </div>
        <div className="row-actions">
          {hasRole(user, MANAGE_EVENT_ROLES) && (
            <Link to="/events/new" className="btn btn-gold">Add event</Link>
          )}
          <div className="segmented" role="group" aria-label="Show">
            <button type="button" className={when === 'upcoming' ? 'active' : ''}
              onClick={() => setWhen('upcoming')}>Upcoming</button>
            <button type="button" className={when === 'past' ? 'active' : ''}
              onClick={() => setWhen('past')}>Past events</button>
          </div>
        </div>
      </div>

      <div className="tabs tabs-bar" role="group" aria-label="Branch">
        <button type="button" className={branch === '' ? 'tab active' : 'tab'}
          onClick={() => setBranch('')}>All branches</button>
        {branches.map((b) => (
          <button key={b._id} type="button" className={branch === b._id ? 'tab active' : 'tab'}
            onClick={() => setBranch(b._id)}>{b.name}</button>
        ))}
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p className="muted">Loading events…</p>}
      {!loading && !error && events.length === 0 && (
        <p className="card muted">
          {when === 'upcoming' ? 'No upcoming events yet.' : 'No past events yet.'}
        </p>
      )}

      <div className="event-list">
        {events.map((e) => (
          <EventCard key={e._id} event={e} onChange={(changes) => update(e._id, changes)} />
        ))}
      </div>
    </div>
  );
}

function EventCard({ event, onChange }) {
  const d = dateParts(event.startsAt);
  return (
    <article className="event-card">
      <div className="event-date" aria-hidden="true">
        <span className="event-month">{d.month}</span>
        <span className="event-day">{d.day}</span>
        <span className="event-weekday">{d.weekday}</span>
      </div>
      <div className="event-body">
        <div className="event-tags">
          <span className="event-kind">{event.kind}</span>
          <span className="pill">{event.branch ? `${event.branch.name} branch` : 'All branches'}</span>
        </div>
        <h2 className="event-title">
          <Link to={`/events/${event._id}`}>{event.title}</Link>
        </h2>
        <div className="event-meta">
          <span>{timeRange(event.startsAt, event.endsAt)}</span>
          {event.venue && <span>{event.venue}</span>}
          <span>
            {event.isPast
              ? `${event.attendedCount} attended`
              : `${event.goingCount} attending`}
          </span>
        </div>
      </div>
      <div className="event-actions">
        <AttendButton event={event} onChange={onChange} />
        {event.isPast && event.iAttended && <span className="pill pill-gold">You were there</span>}
        {event.canScan && !event.isPast && (
          <Link to={`/events/${event._id}/scan`} className="btn btn-small">Scan cards</Link>
        )}
        {event.canManage && (
          <Link to={`/events/${event._id}/edit`} className="btn btn-small">Edit</Link>
        )}
      </div>
    </article>
  );
}

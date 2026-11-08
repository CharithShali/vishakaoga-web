import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import DownloadButtons from '../components/DownloadButtons.jsx';
import AttendButton from '../components/AttendButton.jsx';
import { longDate, timeOnly, timeRange } from '../utils/time.js';

export default function EventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api(`/events/${id}`)
      .then((d) => setEvent(d.event))
      .catch((e) => setError(e.message));
  }, [id]);

  async function remove() {
    try {
      await api(`/events/${id}`, { method: 'DELETE' });
      navigate('/events');
    } catch (e) {
      setError(e.message);
    }
  }

  if (!event) {
    return error
      ? <p className="container page alert alert-error">{error}</p>
      : <p className="container page muted">Loading…</p>;
  }

  return (
    <div className="container page">
      <p><Link to="/events">← All events</Link></p>
      <div className="event-head">
        <div className="event-tags">
          <span className="event-kind">{event.kind}</span>
          <span className="pill">{event.branch ? `${event.branch.name} branch` : 'All branches'}</span>
        </div>
        <h1>{event.title}</h1>
        <dl className="event-facts">
          <div><dt>When</dt><dd>{longDate(event.startsAt)}, {timeRange(event.startsAt, event.endsAt)} <span className="muted small">(Sri Lanka time)</span></dd></div>
          {event.venue && <div><dt>Where</dt><dd>{event.venue}</dd></div>}
          <div><dt>Coming</dt><dd>{event.goingCount} said they're attending{event.attendedCount > 0 ? ` · ${event.attendedCount} checked in` : ''}</dd></div>
        </dl>
        {event.description && <p className="event-description">{event.description}</p>}

        <div className="row-actions">
          <AttendButton event={event} onChange={(c) => setEvent((e) => ({ ...e, ...c }))} />
          {event.canScan && !event.isPast && (
            <Link to={`/events/${event._id}/scan`} className="btn btn-gold">Scan cards at the gate</Link>
          )}
          {event.canManage && (
            <>
              <Link to={`/events/${event._id}/edit`} className="btn">Edit</Link>
              {confirmDelete ? (
                <span className="row-actions">
                  <span className="small">Delete this event and its lists?</span>
                  <button type="button" className="btn btn-small btn-danger" onClick={remove}>Yes, delete</button>
                  <button type="button" className="btn btn-small" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </span>
              ) : (
                <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>Delete…</button>
              )}
            </>
          )}
        </div>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
      </div>

      {event.canScan && <AttendeeList eventId={event._id} isPast={event.isPast} />}
    </div>
  );
}

// Committee view: who said they're coming, and who was scanned in.
function AttendeeList({ eventId, isPast }) {
  const [data, setData] = useState(null);
  const [show, setShow] = useState('all');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/events/${eventId}/attendees`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function undo(person) {
    try {
      await api(`/events/${eventId}/checkin/${person._id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!data) return <p className="muted">Loading the list…</p>;

  const people = data.attendees.filter((p) =>
    show === 'attended' ? p.attendedAt : show === 'notyet' ? p.going && !p.attendedAt : true
  );

  return (
    <section className="card section">
      <div className="section-head">
        <h2>Who's coming</h2>
        <div className="tabs" role="group" aria-label="Show">
          <button type="button" className={show === 'all' ? 'tab active' : 'tab'} onClick={() => setShow('all')}>
            Everyone ({data.attendees.length})
          </button>
          <button type="button" className={show === 'attended' ? 'tab active' : 'tab'} onClick={() => setShow('attended')}>
            Checked in ({data.attendedCount})
          </button>
          {!isPast && (
            <button type="button" className={show === 'notyet' ? 'tab active' : 'tab'} onClick={() => setShow('notyet')}>
              Not here yet
            </button>
          )}
        </div>
      </div>
      <DownloadButtons path={`/exports/events/${eventId}`} label="Download the attendance list:" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Branch</th>
              <th>Batch</th>
              <th>Said attending</th>
              <th>Checked in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr><td colSpan="6" className="muted">Nobody here yet.</td></tr>
            )}
            {people.map((p) => (
              <tr key={p._id}>
                <td className="strong">
                  {p.fullName}
                  {p.memberNo && <div className="muted small">{p.memberNo}</div>}
                </td>
                <td>{p.branch}</td>
                <td>{p.batchYear || '—'}</td>
                <td>{p.going ? 'Yes' : '—'}</td>
                <td>
                  {p.attendedAt ? timeOnly(p.attendedAt) : '—'}
                  {p.scannedBy && <div className="muted small">by {p.scannedBy}</div>}
                </td>
                <td>
                  {p.attendedAt && (
                    <button type="button" className="btn btn-small" onClick={() => undo(p)}
                      title="Remove this check-in if it was scanned by mistake">Undo</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

// "I'm attending" / "You're going" toggle. Calls onChange({ iAmGoing, goingCount }).
export default function AttendButton({ event, onChange }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (event.isPast) return null;
  if (!user) {
    return <Link to="/login" className="btn">Log in to say you're coming</Link>;
  }

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const method = event.iAmGoing ? 'DELETE' : 'POST';
      const res = await api(`/events/${event._id}/rsvp`, { method });
      onChange({ iAmGoing: !event.iAmGoing, goingCount: res.goingCount });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="attend">
      <button type="button" onClick={toggle} disabled={busy}
        className={event.iAmGoing ? 'btn btn-going' : 'btn btn-navy'}
        aria-pressed={event.iAmGoing}>
        {event.iAmGoing ? "You're going ✓" : "I'm attending"}
      </button>
      {error && <span className="small error-text">{error}</span>}
    </div>
  );
}

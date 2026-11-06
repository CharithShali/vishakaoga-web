import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { canManageEvent } from '../auth/permissions.js';
import { EVENT_KINDS } from '../options.js';

const EMPTY = {
  title: '',
  kind: 'Get-together',
  branch: '',
  startsAt: '',
  endsAt: '',
  venue: '',
  description: '',
};

// Create a new event (/events/new) or edit one (/events/:id/edit).
export default function EventFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    api(`/events/${id}`)
      .then(({ event }) => {
        setForm({
          title: event.title,
          kind: event.kind,
          branch: event.branch?._id || '',
          startsAt: event.startsAtLocal,
          endsAt: event.endsAtLocal,
          venue: event.venue,
          description: event.description,
        });
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [editing, id]);

  // Only the branches she may create events for. "All branches" needs a central role.
  const branchOptions = branches.filter((b) => canManageEvent(user, b._id));
  const canDoJoint = canManageEvent(user, null);

  // A branch coordinator's event defaults to her branch.
  useEffect(() => {
    if (!editing && !form.branch && !canDoJoint && branchOptions.length > 0) {
      setForm((f) => ({ ...f, branch: branchOptions[0]._id }));
    }
  }, [editing, form.branch, canDoJoint, branchOptions]);

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { event } = await api(editing ? `/events/${id}` : '/events', {
        method: editing ? 'PUT' : 'POST',
        body: form,
      });
      navigate(`/events/${event._id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!loaded) {
    return error
      ? <p className="container page alert alert-error">{error}</p>
      : <p className="container page muted">Loading…</p>;
  }

  return (
    <div className="container page narrow-wide">
      <p><Link to={editing ? `/events/${id}` : '/events'}>← Back</Link></p>
      <h1>{editing ? 'Edit event' : 'Add an event'}</h1>
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          Title *
          <input type="text" value={form.title} onChange={field('title')}
            placeholder="e.g. Annual OGA Get-Together" required />
        </label>
        <div className="grid-fields">
          <label className="field">
            Type
            <select value={form.kind} onChange={field('kind')}>
              {EVENT_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="field">
            For
            <select value={form.branch} onChange={field('branch')}>
              {canDoJoint && <option value="">All branches (joint event)</option>}
              {branchOptions.map((b) => <option key={b._id} value={b._id}>{b.name} branch</option>)}
            </select>
          </label>
        </div>
        <div className="grid-fields">
          <label className="field">
            Starts * <span className="muted small">(Sri Lanka time)</span>
            <input type="datetime-local" value={form.startsAt} onChange={field('startsAt')} required />
          </label>
          <label className="field">
            Ends <span className="muted small">(optional, 4 hours if empty)</span>
            <input type="datetime-local" value={form.endsAt} onChange={field('endsAt')} />
          </label>
        </div>
        <label className="field">
          Venue *
          <input type="text" value={form.venue} onChange={field('venue')}
            placeholder="e.g. School main hall, Kandy" required />
        </label>
        <label className="field">
          Details
          <textarea rows="4" value={form.description} onChange={field('description')}
            placeholder="Programme, dress code, what to bring…" />
        </label>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <div className="row-actions">
          <button type="submit" className="btn btn-navy btn-lg" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add event'}
          </button>
          <Link to={editing ? `/events/${id}` : '/events'}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}

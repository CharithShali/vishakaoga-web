import { useEffect, useState } from 'react';
import { api } from '../api.js';
import MemberCard from './MemberCard.jsx';

// New registrations waiting for approval, shown as the card she will get,
// with her details beside it. Approve gives her a member number and QR code.
export default function PendingRegistrations({ branchFilter, onReviewed }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const query = branchFilter ? `?branch=${branchFilter}` : '';
    api(`/registrations${query}`)
      .then((d) => setItems(d.registrations))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [branchFilter]);

  function removeItem(id, message) {
    setItems((list) => list.filter((r) => r._id !== id));
    setNotice(message);
    onReviewed?.();
  }

  return (
    <section className="card section">
      <div className="section-head">
        <h2>New registrations {items.length > 0 && <span className="count">{items.length}</span>}</h2>
      </div>
      {notice && <p className="alert alert-ok" role="status">{notice}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && items.length === 0 && !error && (
        <p className="muted">No registrations waiting for approval.</p>
      )}
      <div className="pending-list">
        {items.map((r) => (
          <PendingItem key={r._id} reg={r} onDone={removeItem} />
        ))}
      </div>
    </section>
  );
}

function PendingItem({ reg, onDone }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function approve() {
    setBusy(true);
    setError('');
    try {
      const res = await api(`/registrations/${reg._id}/approve`, { method: 'POST' });
      onDone(reg._id, `${res.name} is approved. Member number ${res.memberNo}.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError('');
    try {
      await api(`/registrations/${reg._id}/reject`, { method: 'POST', body: { note } });
      onDone(reg._id, `${reg.fullName}'s registration was not approved. Please let her know why.`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const p = reg.profession || {};
  const details = [
    ['Email', reg.email],
    ['Phone', reg.phone],
    ['Name at school', reg.nameAtSchool],
    ['School years', [reg.yearJoined, reg.batchYear].filter(Boolean).join(' – ')],
    ['House', reg.house],
    ['Admission no.', reg.admissionNo],
    ['Also studied at', reg.otherBranch?.branch && `${reg.otherBranch.branch.name} ${reg.otherBranch.years ? `(${reg.otherBranch.years})` : ''}`],
    ['Sports', reg.sports],
    ['Achievements', reg.otherAchievements],
    ['Profession', [p.category, p.title, p.workplace].filter(Boolean).join(' · ')],
    ['Lives in', reg.currentCity],
    ['Registered', new Date(reg.createdAt).toLocaleDateString()],
  ].filter(([, value]) => value);

  return (
    <article className="pending-item">
      <MemberCard
        name={reg.fullName}
        branchName={reg.branch?.name}
        batchYear={reg.batchYear}
        lastClass={reg.lastClass}
        schoolRoles={reg.schoolRoles}
        photoUrl={reg.photoUrl}
        status="Waiting for approval"
      />
      <div className="pending-details">
        <dl>
          {details.map(([label, value]) => (
            <div key={label} className="dl-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {error && <p className="alert alert-error" role="alert">{error}</p>}

        {rejecting ? (
          <div className="reject-box">
            <label className="field">
              Why is it not approved? (she isn't told automatically; please call her)
              <textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Photo is not clear, or not a past pupil of this branch" />
            </label>
            <div className="row-actions">
              <button type="button" className="btn btn-danger" onClick={reject}
                disabled={busy || note.trim().length < 3}>Confirm: not approved</button>
              <button type="button" className="btn" onClick={() => setRejecting(false)} disabled={busy}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="row-actions">
            <button type="button" className="btn btn-navy" onClick={approve} disabled={busy}>
              {busy ? 'Saving…' : 'Approve'}
            </button>
            <button type="button" className="btn" onClick={() => setRejecting(true)} disabled={busy}>
              Not approved…
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { hasRole, roleText } from '../auth/permissions.js';
import MemberCard from '../components/MemberCard.jsx';
import { lkr, shortDate } from '../utils/money.js';
import { longDate } from '../utils/time.js';

const THIS_YEAR = new Date().getFullYear();
const onDate = (d) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(d));

const STATUS_TEXT = {
  active: 'Active member',
  pending: 'Waiting for approval',
  suspended: 'Membership removed',
  rejected: 'Registration not approved',
};

// One member: details, payment history, events, and (admin) remove / restore / delete.
export default function MemberDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [qr, setQr] = useState('');

  const load = useCallback(() => {
    api(`/users/${id}/details`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const memberNo = data?.member?.memberNo;
  useEffect(() => {
    if (!memberNo) return;
    QRCode.toDataURL(memberNo, { width: 300, margin: 1, color: { dark: '#0E1D38', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [memberNo]);

  if (!data) {
    return error
      ? <p className="container page alert alert-error">{error}</p>
      : <p className="container page muted">Loading…</p>;
  }

  const m = data.member;
  const p = m.profession || {};
  const paidThisYear = data.paidYears.includes(THIS_YEAR);
  const isMe = m._id === user._id;

  const rows = (pairs) => pairs.filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0));
  const contact = rows([
    ['Email', m.email],
    ['Phone', m.phone],
    ['Lives in', m.currentCity],
    ['Address', m.address],
  ]);
  const school = rows([
    ['Branch', m.branch?.name],
    ['Also studied at', m.otherBranch?.branch && `${m.otherBranch.branch.name}${m.otherBranch.years ? ` (${m.otherBranch.years})` : ''}`],
    ['School years', [m.yearJoined, m.batchYear].filter(Boolean).join(' – ')],
    ['Last class', m.lastClass],
    ['House', m.house],
    ['Admission no.', m.admissionNo],
    ['Roles at school', m.schoolRoles?.join(', ')],
    ['Sports', m.sports],
    ['Achievements', m.otherAchievements],
    ['Name at school', m.nameAtSchool],
  ]);
  const work = rows([
    ['Field', p.category],
    ['Job title', p.title],
    ['Workplace', p.workplace],
    ['Shown to members', p.category ? (p.showToMembers ? 'Yes' : 'No, committee only') : ''],
  ]);
  const membership = rows([
    ['Status', STATUS_TEXT[m.status] || m.status],
    ['Member number', m.memberNo],
    ['Registered', m.createdAt && onDate(m.createdAt)],
    ['Approved', m.review?.at && m.status !== 'rejected' ? `${onDate(m.review.at)}${m.review.by?.fullName ? ` by ${m.review.by.fullName}` : ''}` : ''],
    ['Committee roles', m.roles?.map(roleText).join(', ')],
    ['Last log in', m.lastLoginAt && onDate(m.lastLoginAt)],
  ]);

  return (
    <div className="container page">
      <p><Link to="/committee">← Committee area</Link></p>

      <div className="member-detail-head">
        <MemberCard
          name={m.fullName}
          branchName={m.branch?.name}
          batchYear={m.batchYear}
          lastClass={m.lastClass}
          schoolRoles={m.schoolRoles}
          memberNo={m.memberNo}
          photoUrl={m.photoUrl}
          qrDataUrl={qr}
          status={STATUS_TEXT[m.status] || m.status}
        />
        <div className="member-detail-summary">
          <h1>{m.fullName}</h1>
          <div className="chips">
            <span className={m.status === 'active' ? 'chip chip-navy' : 'chip chip-danger'}>{STATUS_TEXT[m.status] || m.status}</span>
            <span className={paidThisYear ? 'chip' : 'chip chip-warn'}>
              {paidThisYear ? `Fee paid for ${THIS_YEAR}` : `No fee recorded for ${THIS_YEAR}`}
            </span>
          </div>
          <dl className="detail-stats">
            <div><dt>Paid in total</dt><dd>{lkr(data.totalPaidCents)}</dd></div>
            <div><dt>Fee paid for</dt><dd>{data.paidYears.length ? data.paidYears.join(', ') : '—'}</dd></div>
            <div><dt>Events attended</dt><dd>{data.events.length}</dd></div>
            <div><dt>Fee reminders</dt><dd>{data.reminders.length}</dd></div>
          </dl>
          {m.status === 'suspended' && m.removal?.at && (
            <p className="alert alert-error">
              Removed on {onDate(m.removal.at)}{m.removal.by?.fullName ? ` by ${m.removal.by.fullName}` : ''}: {m.removal.reason}
            </p>
          )}
          {hasRole(user, ['treasurer']) && m.status === 'active' && (
            <Link
              className="btn btn-navy"
              to={`/funds/record?type=in&category=${encodeURIComponent('Membership fee')}&member=${m._id}&memberName=${encodeURIComponent(`${m.fullName} (${m.memberNo || 'no number'})`)}&year=${THIS_YEAR}&branch=${m.branch?._id || ''}`}
            >
              Record a payment
            </Link>
          )}
        </div>
      </div>

      {notice && <p className="alert alert-ok" role="status">{notice}</p>}

      <div className="detail-grid">
        <DetailCard title="Contact" rows={contact} />
        <DetailCard title="Membership" rows={membership} />
        <DetailCard title="School years" rows={school} />
        <DetailCard title="Work" rows={work} empty="No profession given." />
      </div>

      <section className="card section">
        <h2>Payment history</h2>
        <div className="table-wrap">
          <table className="money-table">
            <thead>
              <tr><th>Date</th><th>Description</th><th>Branch</th><th>Fund</th><th className="num">Amount</th><th>Recorded by</th></tr>
            </thead>
            <tbody>
              {data.payments.length === 0 && (
                <tr><td colSpan="6" className="muted">No payments recorded for her yet.</td></tr>
              )}
              {data.payments.map((t) => {
                const voided = Boolean(t.voided?.at);
                return (
                  <tr key={t._id} className={voided ? 'voided' : ''}>
                    <td className="nowrap">{shortDate(t.date)}</td>
                    <td>
                      <span className="strong">{t.description}</span>
                      <div className="muted small">
                        {[
                          t.category !== t.description && t.category,
                          t.subscriptionYear && `fee for ${t.subscriptionYear}`,
                          t.reference && `Ref ${t.reference}`,
                          t.paymentMethod,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {voided && <div className="small void-note">Voided: {t.voided.reason}</div>}
                    </td>
                    <td>{t.branch?.name || 'Central'}</td>
                    <td>{t.fund?.name}</td>
                    <td className="num strong nowrap">{t.type === 'in' ? '+' : '−'} {lkr(t.amountCents)}</td>
                    <td className="muted">{t.recordedBy?.fullName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card section">
        <h2>Events attended</h2>
        {data.events.length === 0 ? (
          <p className="muted">No events checked in yet.</p>
        ) : (
          <ul className="event-mini-list">
            {data.events.map((e) => (
              <li key={e._id}>
                <Link to={`/events/${e._id}`}>{e.title}</Link>
                <span className="muted small"> · {longDate(e.startsAt)} · {e.branch}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.canManage && !isMe && (
        <MembershipActions member={m} onDone={(message) => { setNotice(message); load(); }} />
      )}
    </div>
  );
}

function DetailCard({ title, rows, empty = 'Nothing given.' }) {
  return (
    <section className="card detail-card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <dl>
          {rows.map(([label, value]) => (
            <div key={label} className="dl-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

// Main admin only: remove (with a reason), restore, or delete permanently.
function MembershipActions({ member, onDone }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // 'remove' | 'delete' | null
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(call, after) {
    setBusy(true);
    setError('');
    try {
      await call();
      after();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const remove = () =>
    act(() => api(`/users/${member._id}/remove`, { method: 'POST', body: { reason } }), () => {
      setMode(null);
      setReason('');
      onDone(`${member.fullName}'s membership was removed. She can no longer log in, and her committee roles were cleared.`);
    });
  const restore = () =>
    act(() => api(`/users/${member._id}/restore`, { method: 'POST' }), () =>
      onDone(`${member.fullName} is an active member again. Add committee roles again if she needs them.`));
  const destroy = () =>
    act(() => api(`/users/${member._id}`, { method: 'DELETE' }), () => navigate('/committee'));

  return (
    <section className="card section danger-zone">
      <h2>Membership</h2>
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {member.status === 'active' && (
        mode === 'remove' ? (
          <div className="inline-confirm wide">
            <label className="field">
              Why is her membership being removed? *
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Asked to leave the association" />
            </label>
            <p className="muted small">She won't be able to log in, and her committee roles are cleared. Her records are kept and you can restore her later.</p>
            <div className="row-actions">
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy || reason.trim().length < 3}>
                {busy ? 'Removing…' : 'Remove membership'}
              </button>
              <button type="button" className="btn" onClick={() => setMode(null)} disabled={busy}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="row-actions">
            <button type="button" className="btn btn-danger" onClick={() => setMode('remove')}>Remove membership…</button>
            <span className="muted small">Reversible. Only the main admin can do this.</span>
          </div>
        )
      )}

      {['suspended', 'rejected'].includes(member.status) && (
        mode === 'delete' ? (
          <div className="inline-confirm wide">
            <p>Delete {member.fullName} and her photo for good? This can't be undone. Her past payments stay in the fund records.</p>
            <div className="row-actions">
              <button type="button" className="btn btn-danger" onClick={destroy} disabled={busy}>Yes, delete permanently</button>
              <button type="button" className="btn" onClick={() => setMode(null)} disabled={busy}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="row-actions">
            {member.status === 'suspended' && (
              <button type="button" className="btn btn-navy" onClick={restore} disabled={busy}>Restore membership</button>
            )}
            <button type="button" className="btn btn-danger" onClick={() => setMode('delete')} disabled={busy}>Delete permanently…</button>
          </div>
        )
      )}
    </section>
  );
}

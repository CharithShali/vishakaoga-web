import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import DownloadButtons from '../components/DownloadButtons.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { hasRole } from '../auth/permissions.js';
import { lkr, shortDate } from '../utils/money.js';
import { feeReminderText, firstNameOf, whatsappLink } from '../utils/feeReminder.js';

const FEE_ROLES = ['secretary', 'treasurer'];
const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR + 1, THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2, THIS_YEAR - 3];
const sentOn = (d) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(d));

// Membership fees: who has paid for a year, who hasn't, and reminders.
export default function FeesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState(THIS_YEAR);
  const [show, setShow] = useState('unpaid');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const isTreasurer = hasRole(user, ['treasurer']);
  const visibleBranches = branches.filter((b) => hasRole(user, FEE_ROLES, b._id));
  const seesAll = visibleBranches.length === branches.length;

  useEffect(() => {
    api('/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  // A branch secretary or treasurer starts on her own branch.
  useEffect(() => {
    if (!seesAll && branch === '' && visibleBranches.length > 0) setBranch(visibleBranches[0]._id);
  }, [seesAll, branch, visibleBranches]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ year: String(year), show });
    if (branch) params.set('branch', branch);
    if (query) params.set('q', query);
    api(`/fees/status?${params}`)
      .then((d) => {
        setData(d);
        setSelected(new Set());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, show, branch, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function remind(body, label) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api('/fees/remind', { method: 'POST', body: { year, branch, ...body } });
      setNotice(
        `${label}: reminder sent to ${res.sent} ${res.sent === 1 ? 'member' : 'members'}` +
          (res.skippedPaid ? ` (${res.skippedPaid} already paid, skipped).` : '.') +
          ' They will see it under the bell when they log in.'
      );
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const unpaidShown = data ? data.members.filter((m) => !m.paid) : [];
  const allChecked = unpaidShown.length > 0 && unpaidShown.every((m) => selected.has(m._id));
  const pct = data && data.total ? Math.round((data.paidCount / data.total) * 100) : 0;

  return (
    <div className="container page">
      <p><Link to="/committee">← Committee area</Link></p>
      <div className="page-head">
        <div>
          <h1>Membership fees</h1>
          <p className="muted">Who has paid for the year, who hasn't, and reminders.</p>
        </div>
        <label className="field">
          Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <div className="tabs tabs-bar" role="group" aria-label="Branch">
        {seesAll && (
          <button type="button" className={branch === '' ? 'tab active' : 'tab'} onClick={() => setBranch('')}>All branches</button>
        )}
        {visibleBranches.map((b) => (
          <button key={b._id} type="button" className={branch === b._id ? 'tab active' : 'tab'}
            onClick={() => setBranch(b._id)}>{b.name}</button>
        ))}
      </div>

      {data && (
        <div className="money-tiles">
          <div className="card money-tile"><span className="muted">Active members</span><span className="money-big">{data.total}</span></div>
          <div className="card money-tile"><span className="muted">Paid for {year}</span><span className="money-big">{data.paidCount} <span className="small muted">({pct}%)</span></span>
            <div className="progress" aria-hidden="true"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="card money-tile money-tile-dark"><span>Not paid yet</span><span className="money-big">{data.unpaidCount}</span></div>
        </div>
      )}

      <section className="card section">
        <div className="member-search" role="search">
          <div className="segmented" role="group" aria-label="Show">
            <button type="button" className={show === 'unpaid' ? 'active' : ''} onClick={() => setShow('unpaid')}>Not paid</button>
            <button type="button" className={show === 'paid' ? 'active' : ''} onClick={() => setShow('paid')}>Paid</button>
            <button type="button" className={show === 'all' ? 'active' : ''} onClick={() => setShow('all')}>Everyone</button>
          </div>
          <label className="field search-field">
            Search
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, member number or batch year" />
          </label>
          <DownloadButtons path="/exports/fees" params={{ year, branch, show }} label="Download:" />
        </div>

        {show !== 'paid' && data && data.unpaidCount > 0 && (
          <div className="row-actions remind-bar">
            <button type="button" className="btn btn-gold" disabled={busy}
              onClick={() => remind({ allUnpaid: true }, 'All unpaid')}>
              Remind all {data.unpaidCount} unpaid
            </button>
            <button type="button" className="btn" disabled={busy || selected.size === 0}
              onClick={() => remind({ memberIds: [...selected] }, 'Selected')}>
              Remind selected ({selected.size})
            </button>
            <span className="muted small">Reminders appear under the bell on the website. Use the WhatsApp buttons to message members directly.</span>
          </div>
        )}

        {notice && <p className="alert alert-ok" role="status">{notice}</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}

        <div className="table-wrap">
          <table className="money-table">
            <thead>
              <tr>
                <th>
                  {show !== 'paid' && (
                    <input type="checkbox" aria-label="Select all unpaid" checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(unpaidShown.map((m) => m._id)))} />
                  )}
                </th>
                <th>Name</th><th>Branch</th><th>Batch</th><th>Phone</th><th>{year} fee</th><th>Last reminder</th><th />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="8" className="muted">Loading…</td></tr>}
              {!loading && data?.members.length === 0 && (
                <tr><td colSpan="8" className="muted">
                  {show === 'unpaid' ? `Everyone here has paid for ${year}.` : 'No members found.'}
                </td></tr>
              )}
              {!loading && data?.members.map((m) => {
                const wa = !m.paid && whatsappLink(m.phone, feeReminderText(firstNameOf(m.fullName), year, m.branch?.name));
                const recordLink = `/funds/record?type=in&category=${encodeURIComponent('Membership fee')}&member=${m._id}&memberName=${encodeURIComponent(`${m.fullName} (${m.memberNo || 'no number'})`)}&year=${year}${m.branch ? `&branch=${m.branch._id}` : ''}`;
                return (
                  <tr key={m._id}>
                    <td>
                      {!m.paid && (
                        <input type="checkbox" aria-label={`Select ${m.fullName}`} checked={selected.has(m._id)}
                          onChange={() => toggle(m._id)} />
                      )}
                    </td>
                    <td className="strong">
                      <Link to={`/committee/members/${m._id}`} className="member-link">{m.fullName}</Link>
                      {m.memberNo && <div className="muted small">{m.memberNo}</div>}
                    </td>
                    <td>{m.branch?.name}</td>
                    <td>{m.batchYear || '—'}</td>
                    <td className="nowrap">{m.phone || '—'}</td>
                    <td>
                      {m.paid ? (
                        <>
                          <span className="type-pill type-in">Paid</span>
                          <div className="muted small">{lkr(m.paidCents)} · {shortDate(m.paidDate)}</div>
                        </>
                      ) : (
                        <span className="type-pill type-out">Not paid</span>
                      )}
                    </td>
                    <td className="small">
                      {m.lastReminderAt ? sentOn(m.lastReminderAt) : '—'}
                      {m.reminderCount > 1 && <div className="muted">{m.reminderCount} sent</div>}
                    </td>
                    <td>
                      <div className="row-actions nowrap">
                        {wa && <a className="btn btn-small btn-whatsapp" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
                        {!m.paid && isTreasurer && <Link to={recordLink} className="btn btn-small">Record fee</Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data?.truncated && <p className="muted small">Showing the first 3,000 members. Use the branch tabs or search to narrow it down.</p>}
      </section>
    </div>
  );
}

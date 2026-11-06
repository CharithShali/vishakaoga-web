import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { lkr, shortDate } from '../utils/money.js';

const THIS_YEAR = String(new Date().getFullYear());

export default function FundsPage() {
  const [meta, setMeta] = useState(null); // funds, years, branches, what she may do
  const [branch, setBranch] = useState(''); // '' all · 'central' · branch id
  const [year, setYear] = useState(THIS_YEAR); // 'all' or '2026'
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const loadMeta = useCallback(() => {
    api('/funds').then(setMeta).catch((e) => setError(e.message));
  }, []);
  useEffect(loadMeta, [loadMeta]);

  useEffect(() => {
    const params = new URLSearchParams({ branch, year });
    api(`/funds/summary?${params}`).then(setSummary).catch((e) => setError(e.message));
  }, [branch, year, reloadKey]);

  if (!meta) {
    return error
      ? <p className="container page alert alert-error">{error}</p>
      : <p className="container page muted">Loading…</p>;
  }

  const canRecord = meta.canRecordCentral || meta.recordBranches.length > 0;
  const periodLabel = year === 'all' ? 'all time' : year;

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Fund records</h1>
          <p className="muted">Every contribution and expense, for each branch and for the association as a whole.</p>
        </div>
        <div className="row-actions funds-filters">
          <label className="field">
            Branch
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">All branches</option>
              {meta.branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              <option value="central">Central only</option>
            </select>
          </label>
          <label className="field">
            Year
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {meta.years.map((y) => <option key={y} value={y}>{y}</option>)}
              <option value="all">All time</option>
            </select>
          </label>
        </div>
      </div>

      {canRecord && (
        <div className="row-actions record-buttons">
          <Link to="/funds/record?type=in" className="btn btn-navy">+ Record money in</Link>
          <Link to="/funds/record?type=out" className="btn">− Record money out</Link>
        </div>
      )}

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {summary && (
        <>
          <div className="money-tiles">
            <div className="card money-tile">
              <span className="muted">Money in ({periodLabel})</span>
              <span className="money-big">{lkr(summary.period.inCents)}</span>
            </div>
            <div className="card money-tile">
              <span className="muted">Money out ({periodLabel})</span>
              <span className="money-big">{lkr(summary.period.outCents)}</span>
            </div>
            <div className="card money-tile money-tile-dark">
              <span>Balance in hand</span>
              <span className="money-big">{lkr(summary.balanceCents)}</span>
              <span className="small">All money in minus all money out, ever</span>
            </div>
          </div>

          <section className="card section">
            <h2>By branch ({periodLabel})</h2>
            <div className="table-wrap">
              <table className="money-table">
                <thead>
                  <tr><th>Branch</th><th className="num">Money in</th><th className="num">Money out</th><th className="num">Difference</th></tr>
                </thead>
                <tbody>
                  {summary.byBranch.map((r) => (
                    <tr key={r.key}>
                      <td className="strong">{r.name}</td>
                      <td className="num">{lkr(r.inCents)}</td>
                      <td className="num">{lkr(r.outCents)}</td>
                      <td className="num strong">{lkr(r.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <h2>Funds</h2>
            <div className="grid grid-3">
              {summary.funds.map((f) => {
                const pct = f.goalCents ? Math.min(100, Math.round((f.inCents / f.goalCents) * 100)) : null;
                return (
                  <div key={f._id} className="card fund-card">
                    <h3>{f.name}</h3>
                    {f.description && <p className="muted small">{f.description}</p>}
                    {pct !== null && (
                      <>
                        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"
                          aria-label={`${f.name}: ${pct}% of goal`}>
                          <div className="progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="small">{lkr(f.inCents)} raised of {lkr(f.goalCents)} ({pct}%)</span>
                      </>
                    )}
                    <dl className="fund-figures">
                      <div><dt>Raised</dt><dd>{lkr(f.inCents)}</dd></div>
                      <div><dt>Spent</dt><dd>{lkr(f.outCents)}</dd></div>
                      <div><dt>Left</dt><dd className="strong">{lkr(f.balanceCents)}</dd></div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <Records meta={meta} branch={branch} year={year} reloadKey={reloadKey}
        onChanged={() => setReloadKey((k) => k + 1)} />

      {meta.canManageFunds && <ManageFunds funds={meta.funds} onSaved={loadMeta} />}

      <p className="alert payments-note">
        <strong>The website does not take payments.</strong> Pay membership fees and donations to your
        branch treasurer by cash or bank transfer as usual. They appear here once recorded.
      </p>
    </div>
  );
}

function Records({ meta, branch, year, reloadKey, onChanged }) {
  const [type, setType] = useState('');
  const [fund, setFund] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (skip) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ branch, year, skip: String(skip) });
        if (type) params.set('type', type);
        if (fund) params.set('fund', fund);
        const d = await api(`/funds/transactions?${params}`);
        setRows((old) => (skip ? [...old, ...d.transactions] : d.transactions));
        setTotal(d.total);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [branch, year, type, fund]
  );

  useEffect(() => {
    load(0);
  }, [load, reloadKey]);

  return (
    <section className="card section">
      <div className="section-head">
        <h2>Records</h2>
        <div className="row-actions">
          <select aria-label="Money in or out" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">In and out</option>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </select>
          <select aria-label="Fund" value={fund} onChange={(e) => setFund(e.target.value)}>
            <option value="">All funds</option>
            {meta.funds.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="table-wrap">
        <table className="money-table">
          <thead>
            <tr>
              <th>Date</th><th>Description</th><th>Branch</th><th>Fund</th><th>Type</th>
              <th className="num">Amount</th><th>Recorded by</th><th />
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan="8" className="muted">No records for these filters.</td></tr>
            )}
            {rows.map((t) => {
              const voided = Boolean(t.voided?.at);
              return (
                <tr key={t._id} className={voided ? 'voided' : ''}>
                  <td className="nowrap">{shortDate(t.date)}</td>
                  <td>
                    <span className="strong">{t.description}</span>
                    <div className="muted small">
                      {t.category}
                      {t.member && ` · ${t.member.fullName}${t.subscriptionYear ? ` (fee for ${t.subscriptionYear})` : ''}`}
                      {t.reference && ` · Ref ${t.reference}`}
                    </div>
                    {voided && (
                      <div className="small void-note">
                        Voided by {t.voided.by?.fullName || 'a treasurer'}: {t.voided.reason}
                      </div>
                    )}
                  </td>
                  <td>{t.branch?.name || 'Central'}</td>
                  <td>{t.fund?.name}</td>
                  <td><span className={t.type === 'in' ? 'type-pill type-in' : 'type-pill type-out'}>{t.type === 'in' ? 'In' : 'Out'}</span></td>
                  <td className="num strong nowrap">{t.type === 'in' ? '+' : '−'} {lkr(t.amountCents)}</td>
                  <td className="muted">{t.recordedBy?.fullName}</td>
                  <td>{t.canEdit && <RowActions t={t} onChanged={onChanged} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row-actions">
        <span className="muted small">{loading ? 'Loading…' : `Showing ${rows.length} of ${total}`}</span>
        {rows.length < total && !loading && (
          <button type="button" className="btn btn-small" onClick={() => load(rows.length)}>Show more</button>
        )}
      </div>
    </section>
  );
}

// Edit, or void with a reason (records are never deleted).
function RowActions({ t, onChanged }) {
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirmVoid() {
    setBusy(true);
    setError('');
    try {
      await api(`/funds/transactions/${t._id}/void`, { method: 'POST', body: { reason } });
      onChanged();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (voiding) {
    return (
      <div className="inline-confirm">
        <label className="field small-field">
          Why void it?
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" />
        </label>
        {error && <span className="small error-text">{error}</span>}
        <div className="row-actions">
          <button type="button" className="btn btn-small btn-danger" onClick={confirmVoid}
            disabled={busy || reason.trim().length < 3}>Void</button>
          <button type="button" className="btn btn-small" onClick={() => setVoiding(false)} disabled={busy}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div className="row-actions nowrap">
      <Link to={`/funds/record/${t._id}`} className="btn btn-small">Edit</Link>
      <button type="button" className="btn btn-small" onClick={() => setVoiding(true)}>Void…</button>
    </div>
  );
}

// Central treasurer / admin: add funds, change descriptions and goals.
function ManageFunds({ funds, onSaved }) {
  const [editing, setEditing] = useState(null); // fund id, 'new', or null
  const [form, setForm] = useState({ name: '', description: '', goal: '' });
  const [error, setError] = useState('');

  function start(fund) {
    setError('');
    setEditing(fund ? fund._id : 'new');
    setForm(fund
      ? { name: fund.name, description: fund.description, goal: fund.goalCents ? String(fund.goalCents / 100) : '' }
      : { name: '', description: '', goal: '' });
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api(editing === 'new' ? '/funds' : `/funds/${editing}`, {
        method: editing === 'new' ? 'POST' : 'PUT',
        body: form,
      });
      setEditing(null);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <section className="card section">
      <div className="section-head">
        <h2>Manage funds</h2>
        <button type="button" className="btn btn-small" onClick={() => start(null)}>Add a fund</button>
      </div>
      <ul className="fund-admin-list">
        {funds.map((f) => (
          <li key={f._id}>
            <span><strong>{f.name}</strong>{f.goalCents ? ` · goal ${lkr(f.goalCents)}` : ''}</span>
            <button type="button" className="btn btn-small" onClick={() => start(f)}>Edit</button>
          </li>
        ))}
      </ul>
      {editing && (
        <form className="form fund-form" onSubmit={save}>
          <div className="grid-fields">
            <label className="field">Name<input type="text" value={form.name} onChange={field('name')} /></label>
            <label className="field">Goal in rupees (optional)<input type="text" inputMode="decimal" value={form.goal} onChange={field('goal')} placeholder="e.g. 500000" /></label>
          </div>
          <label className="field">Description<input type="text" value={form.description} onChange={field('description')} /></label>
          {error && <p className="alert alert-error">{error}</p>}
          <div className="row-actions">
            <button type="submit" className="btn btn-navy">{editing === 'new' ? 'Add fund' : 'Save'}</button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

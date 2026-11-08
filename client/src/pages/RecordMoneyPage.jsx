import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { todayInColombo } from '../utils/money.js';

// Record money in or out (/funds/record?type=in) or correct a record (/funds/record/:id).
export default function RecordMoneyPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({
    type: params.get('type') === 'out' ? 'out' : 'in',
    date: todayInColombo(),
    amount: '',
    category: params.get('category') || '',
    description: '',
    fund: '',
    branch: '',
    paymentMethod: 'Cash',
    reference: '',
    // "Record fee" on the Membership fees page fills these in
    member: params.get('member') || '',
    subscriptionYear: params.get('year') || '',
  });
  const [memberLabel, setMemberLabel] = useState(params.get('memberName') || '');
  const prefilledBranch = params.get('branch') || '';
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Funds, categories and the branches she may record for.
  useEffect(() => {
    api('/funds')
      .then((m) => {
        setMeta(m);
        setForm((f) => ({
          ...f,
          fund: f.fund || m.funds[0]?._id || '',
          // Default branch: her own branch if she is a branch treasurer, otherwise central.
          branch:
            f.branch ||
            (m.recordBranches.includes(prefilledBranch) ? prefilledBranch : '') ||
            (m.canRecordCentral ? 'central' : m.recordBranches[0] || ''),
        }));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!editing) return;
    api(`/funds/transactions/${id}`)
      .then(({ transaction: t }) => {
        setForm({
          type: t.type,
          date: t.date,
          amount: t.amountText,
          category: t.category,
          description: t.description,
          fund: t.fund,
          branch: t.branch || 'central',
          paymentMethod: t.paymentMethod,
          reference: t.reference,
          member: t.member?._id || '',
          subscriptionYear: t.subscriptionYear || '',
        });
        if (t.member) setMemberLabel(`${t.member.fullName} (${t.member.memberNo || 'no number'})`);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [editing, id]);

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Changing in/out changes the category list.
  function setType(type) {
    setForm((f) => ({ ...f, type, category: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(editing ? `/funds/transactions/${id}` : '/funds/transactions', {
        method: editing ? 'PUT' : 'POST',
        body: form,
      });
      navigate('/funds');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!meta || !loaded) {
    return error
      ? <p className="container page alert alert-error">{error}</p>
      : <p className="container page muted">Loading…</p>;
  }

  const isFee = form.type === 'in' && form.category === 'Membership fee';
  const branchOptions = meta.branches.filter((b) => meta.recordBranches.includes(b._id));

  return (
    <div className="container page narrow-wide">
      <p><Link to="/funds">← Fund records</Link></p>
      <h1>{editing ? 'Correct a record' : form.type === 'in' ? 'Record money in' : 'Record money out'}</h1>
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <div className="segmented" role="group" aria-label="Money in or out">
          <button type="button" className={form.type === 'in' ? 'active' : ''} onClick={() => setType('in')}>Money in</button>
          <button type="button" className={form.type === 'out' ? 'active' : ''} onClick={() => setType('out')}>Money out</button>
        </div>

        <div className="grid-fields">
          <label className="field">
            Date *
            <input type="date" value={form.date} max={todayInColombo()} onChange={field('date')} required />
          </label>
          <label className="field">
            Amount (LKR) *
            <input type="text" inputMode="decimal" value={form.amount} onChange={field('amount')}
              placeholder="e.g. 5000 or 5000.50" required />
          </label>
          <label className="field">
            Category *
            <select value={form.category} onChange={field('category')} required>
              <option value="">Choose…</option>
              {meta.categories[form.type].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          Description *
          <input type="text" value={form.description} onChange={field('description')}
            placeholder={form.type === 'in' ? 'e.g. Membership fee, or Donation from Batch 1998' : 'e.g. Venue and food for the get-together'}
            required />
        </label>

        <div className="grid-fields">
          <label className="field">
            Fund *
            <select value={form.fund} onChange={field('fund')}>
              {meta.funds.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
          </label>
          <label className="field">
            Branch *
            <select value={form.branch} onChange={field('branch')}>
              {meta.canRecordCentral && <option value="central">Central (all branches)</option>}
              {branchOptions.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </label>
          <label className="field">
            Paid by
            <select value={form.paymentMethod} onChange={field('paymentMethod')}>
              {meta.paymentMethods.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="field">
            Receipt / slip no.
            <input type="text" value={form.reference} onChange={field('reference')} placeholder="Optional" />
          </label>
        </div>

        {form.type === 'in' && (
          <div className="subpanel">
            <span className="subpanel-title">{isFee ? 'Who paid the membership fee? *' : 'Paid by a member? (optional)'}</span>
            <MemberPicker
              value={form.member}
              label={memberLabel}
              onPick={(m) => {
                setForm((f) => ({ ...f, member: m ? m._id : '' }));
                setMemberLabel(m ? `${m.fullName} (${m.memberNo || 'no number'})` : '');
              }}
            />
            {isFee && (
              <label className="field fee-year">
                Membership fee for the year
                <input type="number" inputMode="numeric" value={form.subscriptionYear}
                  onChange={field('subscriptionYear')} placeholder={form.date.slice(0, 4)} />
              </label>
            )}
            {isFee && <p className="muted small">Her "My card" page will then show "Membership fee paid" for that year.</p>}
          </div>
        )}

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <div className="row-actions">
          <button type="submit" className="btn btn-navy btn-lg" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save correction' : 'Save record'}
          </button>
          <Link to="/funds">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

// Search members by name or member number, then pick one.
function MemberPicker({ value, label, onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api(`/funds/member-search?q=${encodeURIComponent(q.trim())}`)
        .then((d) => setResults(d.members))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  if (value) {
    return (
      <div className="row-actions">
        <span className="chip chip-navy">{label}</span>
        <button type="button" className="btn btn-small" onClick={() => onPick(null)}>Change</button>
      </div>
    );
  }

  return (
    <div className="member-picker">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Type her name or member number" aria-label="Find the member" />
      {results.length > 0 && (
        <ul className="picker-results">
          {results.map((m) => (
            <li key={m._id}>
              <button type="button" onClick={() => { onPick(m); setQ(''); }}>
                <strong>{m.fullName}</strong>
                <span className="muted small"> {m.memberNo} · {m.branch?.name}{m.batchYear ? ` · ${m.batchYear}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

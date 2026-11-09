import { createContext, useCallback, useContext, useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import ImagePicker from '../components/ImagePicker.jsx';

// Pickers report a chosen-but-not-added picture here, so Save waits for it.
const PendingPictures = createContext(() => {});

// Edit the whole history page (central Secretary / main admin). Saved in one go.
export default function HistoryEditPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const reportPending = useCallback((on) => setWaiting((n) => Math.max(0, n + (on ? 1 : -1))), []);

  useEffect(() => {
    api('/history')
      .then((d) => {
        if (!d.canEdit) {
          setError('The history page is edited by the central Secretary or the main admin.');
          return;
        }
        const pic = (id, url) => (id ? { id, url } : null);
        setForm({
          ...d.history,
          honours: d.history.honours.map((x) => ({ ...x, photo: pic(x.photoId, x.photoUrl) })),
        });
        setBranches(
          d.branches.map((b) => ({
            _id: b._id,
            name: b.name,
            foundedYear: b.foundedYear || '',
            address: b.address || '',
            principal: b.principal || '',
            about: b.about || '',
            photo: pic(b.photoId, b.photoUrl),
          }))
        );
      })
      .catch((e) => setError(e.message));
  }, []);

  if (!form) {
    return error ? <p className="container page alert alert-error">{error}</p> : <p className="container page muted">Loading…</p>;
  }

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBranch = (i, changes) => setBranches((list) => list.map((b, j) => (j === i ? { ...b, ...changes } : b)));
  const branchOptions = branches.map((b) => ({ value: b._id, label: b.name }));

  async function save(e) {
    e.preventDefault();
    if (waiting) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        ...form,
        honours: form.honours.map(({ photo, photoUrl: _url, ...x }) => ({ ...x, photoId: photo?.id || '' })),
        branches: branches.map(({ photo, name: _name, ...b }) => ({ ...b, photoId: photo?.id || '' })),
      };
      delete body.updatedAt;
      await api('/history', { method: 'PUT', body });
      navigate('/history');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="container page history-edit">
      <p><Link to="/history">← History page</Link></p>
      <h1>Edit the history page</h1>
      <p className="muted">
        Everything here is public. Leave a section empty to hide it. Nothing is saved until you press
        <strong> Save the page</strong> at the bottom.
      </p>

      <PendingPictures.Provider value={reportPending}>
      <form onSubmit={save} noValidate>
        <section className="card section form">
          <h2>Our story</h2>
          <label className="field">
            Heading
            <input type="text" value={form.storyTitle} onChange={text('storyTitle')} placeholder="e.g. 100+ years of Vishaka" />
          </label>
          <label className="field">
            <span className="field-label">The story <span className="muted small">(two or three short paragraphs)</span></span>
            <textarea rows="5" value={form.story} onChange={text('story')} />
          </label>
          <div className="grid-fields">
            <label className="field">
              School motto
              <input type="text" value={form.motto} onChange={text('motto')} />
            </label>
            <label className="field">
              What the motto means
              <input type="text" value={form.mottoMeaning} onChange={text('mottoMeaning')} />
            </label>
          </div>
        </section>

        <section className="card section">
          <h2>School history</h2>
          <p className="muted small">The important years, oldest first.</p>
          <RowList
            rows={form.timeline}
            onChange={set('timeline')}
            empty={{ year: '', title: '', text: '' }}
            addLabel="Add a year"
            fields={[
              { key: 'year', label: 'Year', placeholder: 'e.g. 1917', size: 'small' },
              { key: 'title', label: 'What happened', placeholder: 'e.g. The school is founded' },
              { key: 'text', label: 'More detail', type: 'textarea', wide: true },
            ]}
          />
        </section>

        <section className="card section">
          <h2>Our branches</h2>
          {branches.map((b, i) => (
            <div key={b._id} className="row-card">
              <h3>{b.name}</h3>
              <div className="grid-fields">
                <label className="field">
                  Since (year)
                  <input type="number" value={b.foundedYear} onChange={(e) => setBranch(i, { foundedYear: e.target.value })} />
                </label>
                <label className="field">
                  Principal
                  <input type="text" value={b.principal} onChange={(e) => setBranch(i, { principal: e.target.value })} />
                </label>
              </div>
              <label className="field">
                Address
                <input type="text" value={b.address} onChange={(e) => setBranch(i, { address: e.target.value })} />
              </label>
              <label className="field">
                <span className="field-label">About this branch <span className="muted small">(houses, traditions…)</span></span>
                <textarea rows="2" value={b.about} onChange={(e) => setBranch(i, { about: e.target.value })} />
              </label>
              <div className="field">
                Photo of the school
                <Picker shape="wide" value={b.photo} onChange={(photo) => setBranch(i, { photo })} />
              </div>
              <p className="muted small">
                The batch wall starts at the "since" year.
              </p>
            </div>
          ))}
        </section>

        <section className="card section">
          <h2>Committee</h2>
          <label className="field narrow-field">
            Term
            <input type="text" value={form.committeeTerm} onChange={text('committeeTerm')} placeholder="e.g. 2025–2026" />
          </label>
          <h3>Central committee</h3>
          <RowList
            rows={form.centralCommittee}
            onChange={set('centralCommittee')}
            empty={{ position: '', name: '', branch: '', batch: '' }}
            addLabel="Add a person"
            fields={[
              { key: 'position', label: 'Position', placeholder: 'e.g. President' },
              { key: 'name', label: 'Name' },
              { key: 'branch', label: 'Branch', type: 'select', options: branchOptions, blank: '—' },
              { key: 'batch', label: 'Batch', placeholder: 'e.g. 1995', size: 'small' },
            ]}
          />
          <h3>Branch committees</h3>
          <RowList
            rows={form.branchCommittees}
            onChange={set('branchCommittees')}
            empty={{ position: '', name: '', branch: branches[0]?._id || '', batch: '' }}
            addLabel="Add a person"
            fields={[
              { key: 'branch', label: 'Branch', type: 'select', options: branchOptions },
              { key: 'position', label: 'Position', placeholder: 'e.g. Branch Secretary' },
              { key: 'name', label: 'Name' },
              { key: 'batch', label: 'Batch', size: 'small' },
            ]}
          />
        </section>

        <section className="card section">
          <h2>Roll of honour: past presidents</h2>
          <RowList
            rows={form.presidents}
            onChange={set('presidents')}
            empty={{ term: '', name: '', branch: '', batch: '' }}
            addLabel="Add a president"
            fields={[
              { key: 'term', label: 'Term', placeholder: 'e.g. 1998–2001', size: 'small' },
              { key: 'name', label: 'Name' },
              { key: 'branch', label: 'Branch', type: 'select', options: branchOptions, blank: '—' },
              { key: 'batch', label: 'Batch', size: 'small' },
            ]}
          />
        </section>

        <section className="card section">
          <h2>Members who made us proud</h2>
          <p className="muted small">Only add people who are happy to be shown on the public website.</p>
          <RowList
            rows={form.honours}
            onChange={set('honours')}
            empty={{ year: '', name: '', branch: '', batch: '', field: '', achievement: '', photo: null }}
            addLabel="Add a member"
            fields={[
              { key: 'name', label: 'Name' },
              { key: 'branch', label: 'Branch', type: 'select', options: branchOptions, blank: '—' },
              { key: 'batch', label: 'Batch', size: 'small' },
              { key: 'field', label: 'Field', placeholder: 'e.g. Medicine, Sport' },
              { key: 'year', label: 'Year', size: 'small' },
              { key: 'achievement', label: 'Achievement', type: 'textarea', wide: true },
              { key: 'photo', label: 'Photo', type: 'photo', wide: true },
            ]}
          />
        </section>

        {error && <p className="alert alert-error section" role="alert">{error}</p>}
        <div className="row-actions section sticky-save">
          <button type="submit" className="btn btn-navy btn-lg" disabled={busy || waiting > 0}>
            {busy ? 'Saving…' : 'Save the page'}
          </button>
          <Link to="/history">Cancel</Link>
          {waiting > 0 && <span className="small">Press "Use this picture" on the picture you chose first.</span>}
        </div>
      </form>
      </PendingPictures.Provider>
    </div>
  );
}

// A list of rows with the same fields: add, remove, move up and down.
function RowList({ rows, onChange, fields, empty, addLabel }) {
  const listId = useId();
  const update = (i, key, value) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const move = (i, by) => {
    const next = [...rows];
    const [row] = next.splice(i, 1);
    next.splice(i + by, 0, row);
    onChange(next);
  };

  return (
    <div className="row-list">
      {rows.map((row, i) => (
        <div key={i} className="row-card">
          <div className="row-fields">
            {fields.map((f) => (
              <div key={f.key} className={`field${f.wide ? ' field-wide' : ''}${f.size === 'small' ? ' field-small' : ''}`}>
                <label htmlFor={`${listId}-${f.key}-${i}`}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea id={`${listId}-${f.key}-${i}`} rows="2" value={row[f.key] || ''}
                    onChange={(e) => update(i, f.key, e.target.value)} />
                ) : f.type === 'select' ? (
                  <select id={`${listId}-${f.key}-${i}`} value={row[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)}>
                    {f.blank !== undefined && <option value="">{f.blank}</option>}
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'photo' ? (
                  <Picker shape="portrait" value={row[f.key]} onChange={(v) => update(i, f.key, v)} />
                ) : (
                  <input id={`${listId}-${f.key}-${i}`} type="text" value={row[f.key] || ''} placeholder={f.placeholder}
                    onChange={(e) => update(i, f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          <div className="row-tools">
            <button type="button" className="btn btn-small" onClick={() => move(i, -1)} disabled={i === 0}
              aria-label="Move up">↑</button>
            <button type="button" className="btn btn-small" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
              aria-label="Move down">↓</button>
            <button type="button" className="btn btn-small" onClick={() => onChange(rows.filter((_, j) => j !== i))}
              aria-label="Remove">Remove</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={() => onChange([...rows, { ...empty }])}>
        + {addLabel}
      </button>
    </div>
  );
}

function Picker(props) {
  const report = useContext(PendingPictures);
  return <ImagePicker {...props} onPendingChange={report} />;
}

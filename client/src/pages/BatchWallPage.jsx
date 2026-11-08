import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

// The batch wall: pick a branch, see every year from the first batch to now.
// Years with members are filled in; years nobody has joined from are "missing".
// Names show only to logged-in members.
export default function BatchWallPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const panelRef = useRef(null);
  const tapped = useRef(false);

  useEffect(() => {
    api('/batches').then(setData).catch((e) => setError(e.message));
  }, []);

  const branchId = params.get('branch') || data?.branches[0]?._id || '';
  const year = Number(params.get('year')) || null;
  const branch = data?.branches.find((b) => b._id === branchId);

  const decades = useMemo(() => {
    if (!branch) return [];
    const out = [];
    for (let d = Math.floor(branch.to / 10) * 10; d >= Math.floor(branch.from / 10) * 10; d -= 10) {
      const years = [];
      for (let y = d; y < d + 10; y++) if (y >= branch.from && y <= branch.to) years.push(y);
      out.push({ decade: d, years });
    }
    return out;
  }, [branch]);

  // On a phone the batch panel sits above the years: after a tap, scroll up to it.
  useEffect(() => {
    if (!year || !tapped.current) return;
    tapped.current = false;
    if (window.matchMedia('(max-width: 900px)').matches) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [year]);

  const choose = (changes) => {
    tapped.current = true;
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  if (error) return <p className="container page alert alert-error">{error}</p>;
  if (!data) return <p className="container page muted">Loading…</p>;

  const allYears = branch ? branch.to - branch.from + 1 : 0;
  const withMembers = branch ? Object.keys(branch.counts).length : 0;
  const memberTotal = branch ? Object.values(branch.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="container page">
      <p className="eyebrow">The batch wall</p>
      <h1>Find your batch</h1>
      <p className="muted lead-narrow">
        Choose your branch, then tap your year to see who has joined. The empty years are batches
        we haven't found yet: if you know someone from one, ask her to register.
      </p>

      <div className="tabs tabs-bar" role="group" aria-label="Branch">
        {data.branches.map((b) => (
          <button key={b._id} type="button" className={b._id === branchId ? 'tab active' : 'tab'}
            onClick={() => choose({ branch: b._id, year: '' })}>{b.name}</button>
        ))}
      </div>

      {branch && (
        <>
          <div className="wall-stats">
            <span><strong>{memberTotal}</strong> {memberTotal === 1 ? 'member' : 'members'}</span>
            <span><strong>{withMembers}</strong> of {allYears} batches have joined</span>
            <span className="wall-legend">
              <span className="wall-key has" /> Has members
              <span className="wall-key missing" /> Missing so far
            </span>
          </div>

          <div className="wall-layout">
            <div className="wall">
              {decades.map(({ decade, years }) => (
                <section key={decade} className="wall-decade" aria-label={`${decade}s`}>
                  <h2>{decade}s</h2>
                  <div className="wall-years">
                    {years.map((y) => {
                      const n = branch.counts[y] || 0;
                      return (
                        <button key={y} type="button"
                          className={`wall-year ${n ? 'has' : 'missing'}${y === year ? ' selected' : ''}`}
                          onClick={() => choose({ year: y === year ? '' : String(y) })}
                          aria-pressed={y === year}
                          aria-label={`${y}: ${n ? `${n} ${n === 1 ? 'member' : 'members'}` : 'no members yet'}`}>
                          <span className="wall-year-num">{y}</span>
                          <span className="wall-year-count">{n || '–'}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <aside ref={panelRef} className={year ? 'wall-panel card' : 'wall-panel card is-empty'} aria-live="polite">
              {year ? (
                <BatchPanel branch={branch} year={year} count={branch.counts[year] || 0} loggedIn={Boolean(user)} />
              ) : (
                <p className="muted">Tap a year to see that batch.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function BatchPanel({ branch, year, count, loggedIn }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setMembers(null);
    setError('');
    if (!loggedIn || !count) return;
    api(`/batches/${branch._id}/${year}`)
      .then((d) => setMembers(d.members))
      .catch((e) => setError(e.message));
  }, [branch._id, year, count, loggedIn]);

  return (
    <>
      <p className="eyebrow">{branch.name}</p>
      <h2>Batch {year}</h2>
      {count === 0 ? (
        <>
          <p>Nobody from this batch has joined yet.</p>
          <p className="muted small">Know someone who left {branch.name} in {year}? Send her the link to register.</p>
          <Link to="/register" className="btn btn-gold btn-small">Registration page</Link>
        </>
      ) : !loggedIn ? (
        <>
          <p>{count} {count === 1 ? 'member has' : 'members have'} joined.</p>
          <p className="muted small">Names are shown to members only.</p>
          <Link to="/login" className="btn btn-navy btn-small">Log in to see who</Link>
        </>
      ) : error ? (
        <p className="alert alert-error">{error}</p>
      ) : !members ? (
        <p className="muted">Loading…</p>
      ) : (
        <ul className="batch-members">
          {members.map((m) => (
            <li key={m._id}>
              <span className="strong">{m.fullName}</span>
              {m.nameAtSchool && m.nameAtSchool !== m.fullName && (
                <span className="muted small"> (at school: {m.nameAtSchool})</span>
              )}
              <div className="muted small">
                {[m.lastClass && `Class ${m.lastClass}`, m.house && `${m.house} house`, m.currentCity && `Lives in ${m.currentCity}`, m.profession]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {m.schoolRoles.length > 0 && <div className="school-roles small">{m.schoolRoles.join(' · ')}</div>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

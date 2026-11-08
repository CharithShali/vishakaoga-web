import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import RichText from '../components/RichText.jsx';

const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

// "Kandy · Batch 2004"
const placeBatch = (branchName, batch) => [branchName, batch && `Batch ${batch}`].filter(Boolean).join(' · ');

export default function HistoryPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/history').then(setData).catch((e) => setError(e.message));
  }, [user]);

  if (error) return <p className="container page alert alert-error">{error}</p>;
  if (!data) return <p className="container page muted">Loading…</p>;

  const { history: h, branches, canEdit } = data;
  const branchName = (id) => branches.find((b) => b._id === id)?.name || '';
  const hasStory = h.story || h.storyTitle || h.motto;
  const nothingYet =
    !hasStory && !h.timeline.length && !h.centralCommittee.length && !h.branchCommittees.length &&
    !h.presidents.length && !h.honours.length;

  return (
    <>
      <section className="hero history-hero">
        <div className="container hero-inner">
          <p className="eyebrow eyebrow-light">Our story</p>
          <h1>{h.storyTitle || 'One school, three cities'}</h1>
          {h.story ? <RichText text={h.story} className="rich-text hero-lead" /> : (
            <p className="hero-lead">The story of Visakha and the friendships that never ended.</p>
          )}
          {h.motto && (
            <figure className="motto">
              <blockquote>“{h.motto}”</blockquote>
              {h.mottoMeaning && <figcaption>{h.mottoMeaning}</figcaption>}
            </figure>
          )}
          {canEdit && (
            <div className="hero-actions">
              <Link to="/history/edit" className="btn btn-gold">Edit this page</Link>
            </div>
          )}
        </div>
      </section>

      <div className="container page history">
        {nothingYet && (
          <p className="card muted">
            This page is still being written. Have old photos or history to add? Contact your branch coordinator.
          </p>
        )}

        {h.timeline.length > 0 && (
          <section className="history-section">
            <p className="eyebrow">School history</p>
            <h2>Through the years</h2>
            <ol className="timeline">
              {h.timeline.map((t, i) => (
                <li key={i}>
                  <span className="timeline-year">{t.year}</span>
                  <div>
                    <h3>{t.title}</h3>
                    {t.text && <RichText text={t.text} />}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="history-section">
          <p className="eyebrow">Our branches</p>
          <h2>Three cities, one school</h2>
          <div className="grid grid-3">
            {branches.map((b) => (
              <article key={b._id} className="card branch-story">
                {b.photoUrl ? (
                  <img src={b.photoUrl} alt={`${b.name} school`} className="branch-photo" loading="lazy" />
                ) : (
                  <div className="branch-photo branch-photo-empty" aria-hidden="true">{b.name}</div>
                )}
                <h3>{b.name}</h3>
                {b.foundedYear && <p className="eyebrow">Since {b.foundedYear}</p>}
                {(b.address || b.principal) && (
                  <p className="muted small">
                    {[b.address, b.principal && `Principal ${b.principal}`].filter(Boolean).join(' · ')}
                  </p>
                )}
                {b.about && <RichText text={b.about} />}
                <Link to={`/batches?branch=${b._id}`} className="small">See the {b.name} batch wall →</Link>
              </article>
            ))}
          </div>
        </section>

        {(h.centralCommittee.length > 0 || h.branchCommittees.length > 0) && (
          <section className="history-section">
            <p className="eyebrow">Committee {h.committeeTerm}</p>
            <h2>The people running the OGA</h2>
            {h.centralCommittee.length > 0 && (
              <div className="people-grid">
                {h.centralCommittee.map((p, i) => (
                  <div key={i} className="person card">
                    <span className="monogram" aria-hidden="true">{initials(p.name)}</span>
                    <div>
                      <p className="person-role">{p.position}</p>
                      <p className="strong">{p.name}</p>
                      <p className="muted small">{placeBatch(branchName(p.branch), p.batch)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {h.branchCommittees.length > 0 && (
              <div className="grid grid-3 section">
                {branches
                  .map((b) => ({ b, people: h.branchCommittees.filter((p) => p.branch === b._id) }))
                  .filter((x) => x.people.length)
                  .map(({ b, people }) => (
                    <div key={b._id} className="card">
                      <h3>{b.name} branch</h3>
                      <dl className="committee-list">
                        {people.map((p, i) => (
                          <div key={i} className="dl-row">
                            <dt>{p.position}</dt>
                            <dd>{p.name}{p.batch && <span className="muted small"> · {p.batch}</span>}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {h.presidents.length > 0 && (
          <section className="history-section">
            <p className="eyebrow">Roll of honour</p>
            <h2>Presidents of the OGA</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Term</th><th>President</th><th>Branch · batch</th></tr></thead>
                <tbody>
                  {h.presidents.map((p, i) => (
                    <tr key={i}>
                      <td className="nowrap">{p.term}</td>
                      <td className="strong">{p.name}</td>
                      <td className="muted">{placeBatch(branchName(p.branch), p.batch) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {h.honours.length > 0 && (
          <section className="history-section">
            <p className="eyebrow">Members who made us proud</p>
            <h2>Our pride</h2>
            <div className="honours-grid">
              {h.honours.map((x, i) => (
                <article key={i} className="card honour">
                  {x.photoUrl ? (
                    <img src={x.photoUrl} alt={x.name} className="honour-photo" loading="lazy" />
                  ) : (
                    <span className="honour-photo monogram monogram-lg" aria-hidden="true">{initials(x.name)}</span>
                  )}
                  <div>
                    {(x.field || x.year) && <p className="person-role">{[x.field, x.year].filter(Boolean).join(' · ')}</p>}
                    <h3>{x.name}</h3>
                    <p className="muted small">{placeBatch(branchName(x.branch), x.batch)}</p>
                    {x.achievement && <p>{x.achievement}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="history-section card batch-teaser">
          <div>
            <p className="eyebrow">The batch wall</p>
            <h2>Find your batch</h2>
            <p className="muted">See who from your year has joined, and which batches we're still missing.</p>
          </div>
          <Link to="/batches" className="btn btn-navy btn-lg">Open the batch wall</Link>
        </section>
      </div>
    </>
  );
}

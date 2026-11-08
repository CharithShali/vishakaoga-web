import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import PostCard from '../components/PostCard.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [posts, setPosts] = useState(null);
  const [wall, setWall] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/branches')
      .then((data) => setBranches(data.branches))
      .catch((err) => setError(err.message));
    api('/batches').then(setWall).catch(() => {});
  }, []);

  useEffect(() => {
    api('/posts?limit=3&published=1')
      .then((d) => setPosts(d.posts))
      .catch(() => setPosts([]));
  }, [user]);

  const wallFor = (id) => wall?.branches.find((b) => b._id === id);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <h1>Welcome to the Visakha OGA</h1>
          <p className="hero-lead">
            One school, three cities. Whether you studied in Kandy, Bandarawela or Colombo,
            register once and stay close to your batch and your branch.
          </p>
          <div className="hero-actions">
            {user ? (
              <>
                <Link to="/card" className="btn btn-gold btn-lg">View my QR card</Link>
                <Link to="/events" className="btn btn-outline-light btn-lg">Events</Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-gold btn-lg">Register as a member</Link>
                <Link to="/login" className="btn btn-outline-light btn-lg">Log in</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {posts && posts.length > 0 && (
        <section className="container page-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">News from the association</p>
              <h2>Latest news</h2>
            </div>
            <Link to="/news" className="btn">All news</Link>
          </div>
          <div className="post-grid">
            {posts.map((p) => <PostCard key={p._id} post={p} />)}
          </div>
        </section>
      )}

      <section className="container page-section">
        <p className="eyebrow">Our branches</p>
        <h2>One school, three cities</h2>
        {error && <p className="alert alert-error">Could not load branches: {error}</p>}
        <div className="grid grid-3">
          {branches.map((b) => {
            const w = wallFor(b._id);
            const members = w ? Object.values(w.counts).reduce((a, n) => a + n, 0) : null;
            return (
              <article key={b._id} className="card branch-card">
                {b.photoUrl ? (
                  <img src={b.photoUrl} alt={`${b.name} school`} className="branch-photo" loading="lazy" />
                ) : (
                  <div className="branch-photo branch-photo-empty" aria-hidden="true">{b.name}</div>
                )}
                <h3>{b.name}</h3>
                <p className="muted small">
                  {[b.foundedYear && `Since ${b.foundedYear}`, members !== null && `${members} ${members === 1 ? 'member' : 'members'}`]
                    .filter(Boolean)
                    .join(' · ') || `Branch code ${b.code}`}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container page-section">
        <div className="card batch-teaser">
          <div>
            <p className="eyebrow">The batch wall</p>
            <h2>Find your batch. Bring back the ones we're missing.</h2>
            <p className="muted">
              Pick your branch and see who from your year has joined. Years with nobody yet are marked,
              so every batch can help find its old classmates.
            </p>
            {wall && (
              <div className="wall-teaser-stats">
                {wall.branches.map((b) => {
                  const total = b.to - b.from + 1;
                  const joined = Object.keys(b.counts).length;
                  return (
                    <Link key={b._id} to={`/batches?branch=${b._id}`} className="wall-teaser-stat">
                      <span className="strong">{b.name}</span>
                      <span className="muted small">{joined} batches joined · {total - joined} missing</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <Link to="/batches" className="btn btn-navy btn-lg">Browse batches</Link>
        </div>
      </section>

      <section className="container page-section last">
        <div className="grid grid-3">
          <Link to="/history" className="card link-card">
            <h3>Our story</h3>
            <p className="muted">School history, the committee and the roll of honour.</p>
          </Link>
          <Link to="/events" className="card link-card">
            <h3>Events</h3>
            <p className="muted">Branch get-togethers, reunions and the joint AGM.</p>
          </Link>
          <Link to={user ? '/funds' : '/login'} className="card link-card">
            <h3>Fund records</h3>
            <p className="muted">Every rupee in and out, for each branch and overall{user ? '' : ' (members)'}.</p>
          </Link>
        </div>
      </section>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { hasRole, POST_ROLES } from '../auth/permissions.js';
import PostCard from '../components/PostCard.jsx';

const CATEGORIES = ['News', 'Notice', 'Reunion', 'Project', 'Achievement', 'Memories'];

export default function NewsPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState('');
  const [category, setCategory] = useState('');
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  function load(skip = 0) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ skip: String(skip) });
    if (branch) params.set('branch', branch);
    if (category) params.set('category', category);
    api(`/posts?${params}`)
      .then((d) => {
        setPosts((list) => (skip ? [...list, ...d.posts] : d.posts));
        setTotal(d.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, category, user]);

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>News</h1>
          <p className="muted">Notices, reunions and projects from all three branches.</p>
        </div>
        {hasRole(user, POST_ROLES) && (
          <Link to="/news/new" className="btn btn-gold">Write a post</Link>
        )}
      </div>

      <div className="tabs tabs-bar" role="group" aria-label="Branch">
        <button type="button" className={branch === '' ? 'tab active' : 'tab'} onClick={() => setBranch('')}>
          All branches
        </button>
        {branches.map((b) => (
          <button key={b._id} type="button" className={branch === b._id ? 'tab active' : 'tab'}
            onClick={() => setBranch(b._id)}>{b.name}</button>
        ))}
      </div>
      <div className="filter-chips" role="group" aria-label="Kind of post">
        <button type="button" className={category === '' ? 'filter-chip active' : 'filter-chip'}
          onClick={() => setCategory('')}>Everything</button>
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={category === c ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="card muted">
          No posts here yet.{!user && ' Some posts are for members only; log in to see them.'}
        </p>
      )}

      <div className="post-grid">
        {posts.map((p) => <PostCard key={p._id} post={p} />)}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && posts.length < total && (
        <p className="center">
          <button type="button" className="btn" onClick={() => load(posts.length)}>Show older posts</button>
        </p>
      )}
    </div>
  );
}

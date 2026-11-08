import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import RichText from '../components/RichText.jsx';
import { postMeta } from '../components/PostCard.jsx';

export default function PostPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError(null);
    api(`/posts/${id}`)
      .then((d) => setPost(d.post))
      .catch((e) => setError(e));
  }, [id, user]);

  async function remove() {
    setBusy(true);
    try {
      await api(`/posts/${id}`, { method: 'DELETE' });
      navigate('/news');
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  if (error && !post) {
    return (
      <div className="container page narrow">
        <p className="alert alert-error">{error.message}</p>
        {error.status === 401 && <p><Link to="/login" className="btn btn-navy">Log in</Link></p>}
        <p><Link to="/news">← All news</Link></p>
      </div>
    );
  }
  if (!post) return <p className="container page muted">Loading…</p>;

  return (
    <article className="container page post-page">
      <p><Link to="/news">← All news</Link></p>
      <p className="eyebrow">{postMeta(post)}</p>
      <h1>{post.title}</h1>
      <div className="chips">
        {post.status === 'draft' && <span className="chip chip-warn">Draft: only the committee can see this</span>}
        {post.membersOnly && <span className="chip">Members only</span>}
      </div>
      {post.summary && <p className="post-lead">{post.summary}</p>}
      {post.coverUrl && <img src={post.coverUrl} alt="" className="post-page-cover" />}
      <RichText text={post.body} className="rich-text post-body" />
      {post.author && <p className="muted small">Posted by {post.author.fullName}</p>}

      {post.canManage && (
        <div className="card section row-actions">
          <Link to={`/news/${post._id}/edit`} className="btn btn-navy">Edit post</Link>
          {confirmDelete ? (
            <>
              <span>Delete this post and its picture for good?</span>
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Yes, delete</button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete…</button>
          )}
          {error && <p className="alert alert-error">{error.message}</p>}
        </div>
      )}
    </article>
  );
}

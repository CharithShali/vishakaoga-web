import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { canManagePost } from '../auth/permissions.js';
import ImagePicker from '../components/ImagePicker.jsx';

const CATEGORIES = ['News', 'Notice', 'Reunion', 'Project', 'Achievement', 'Memories'];
const EMPTY = { title: '', category: 'News', branch: '', summary: '', body: '', membersOnly: false, cover: null };

// Write a post (/news/new) or edit one (/news/:id/edit).
export default function PostFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [wasPublished, setWasPublished] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [picturePending, setPicturePending] = useState(false);

  useEffect(() => {
    api('/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    api(`/posts/${id}`)
      .then(({ post }) => {
        setForm({
          title: post.title,
          category: post.category,
          branch: post.branch?._id || '',
          summary: post.summary,
          body: post.body,
          membersOnly: post.membersOnly,
          cover: post.coverId ? { id: post.coverId, url: post.coverUrl } : null,
        });
        setWasPublished(post.status === 'published');
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [editing, id]);

  // Only branches she may post for. "All branches" needs a central role.
  const branchOptions = branches.filter((b) => canManagePost(user, b._id));
  const canDoAll = canManagePost(user, null);
  useEffect(() => {
    if (!editing && !form.branch && !canDoAll && branchOptions.length > 0) {
      setForm((f) => ({ ...f, branch: branchOptions[0]._id }));
    }
  }, [editing, form.branch, canDoAll, branchOptions]);

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(status) {
    if (picturePending) return; // Enter key while a picture is waiting
    setError('');
    setBusy(status);
    try {
      const { cover, ...rest } = form;
      const { post } = await api(editing ? `/posts/${id}` : '/posts', {
        method: editing ? 'PUT' : 'POST',
        body: { ...rest, coverId: cover?.id || '', status },
      });
      navigate(`/news/${post._id}`);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  }

  if (!loaded) {
    return error
      ? <p className="container page alert alert-error">{error}</p>
      : <p className="container page muted">Loading…</p>;
  }

  return (
    <div className="container page narrow-wide">
      <p><Link to={editing ? `/news/${id}` : '/news'}>← Back</Link></p>
      <h1>{editing ? 'Edit post' : 'Write a post'}</h1>
      <form className="card form" onSubmit={(e) => { e.preventDefault(); save('published'); }} noValidate>
        <label className="field">
          Title *
          <input type="text" value={form.title} onChange={field('title')} maxLength={140}
            placeholder="e.g. Annual General Meeting notice" required />
        </label>
        <div className="grid-fields">
          <label className="field">
            Kind of post
            <select value={form.category} onChange={field('category')}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            For
            <select value={form.branch} onChange={field('branch')}>
              {canDoAll && <option value="">All branches</option>}
              {branchOptions.map((b) => <option key={b._id} value={b._id}>{b.name} branch</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Short summary <span className="muted small">(shown on the news list and the home page)</span></span>
          <textarea rows="2" value={form.summary} onChange={field('summary')} maxLength={300}
            placeholder="One or two sentences" />
        </label>
        <div className="field">
          <span className="field-label">Picture <span className="muted small">(optional; everyone can see it)</span></span>
          <ImagePicker shape="wide" value={form.cover} onChange={(cover) => setForm((f) => ({ ...f, cover }))}
            onPendingChange={setPicturePending} />
        </div>
        <label className="field">
          The post
          <textarea rows="12" value={form.body} onChange={field('body')}
            placeholder={'Write here. Leave an empty line between paragraphs.\nWeb links (https://…) become clickable.'} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.membersOnly}
            onChange={(e) => setForm((f) => ({ ...f, membersOnly: e.target.checked }))} />
          Members only (hide it from people who are not logged in)
        </label>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {picturePending && (
          <p className="alert" role="status">Finish adding the picture first (press "Use this picture"), then save.</p>
        )}
        <div className="row-actions">
          <button type="submit" className="btn btn-navy btn-lg" disabled={Boolean(busy) || picturePending}>
            {busy === 'published' ? 'Saving…' : editing && wasPublished ? 'Save changes' : 'Publish'}
          </button>
          <button type="button" className="btn btn-lg" disabled={Boolean(busy) || picturePending} onClick={() => save('draft')}>
            {busy === 'draft' ? 'Saving…' : wasPublished ? 'Unpublish (back to draft)' : 'Save as draft'}
          </button>
          <Link to={editing ? `/news/${id}` : '/news'}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}

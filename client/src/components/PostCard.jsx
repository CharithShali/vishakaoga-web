import { Link } from 'react-router-dom';

const postDate = (d) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(d));

// One line under a post title: "4 Nov 2026 · Kandy · Reunion"
export function postMeta(post) {
  return [
    post.status === 'draft' ? 'Draft' : post.publishedAt && postDate(post.publishedAt),
    post.branch?.name || 'All branches',
    post.category,
  ]
    .filter(Boolean)
    .join(' · ');
}

// A news card for the news list and the home page.
export default function PostCard({ post }) {
  return (
    <article className={post.status === 'draft' ? 'post-card is-draft' : 'post-card'}>
      <Link to={`/news/${post._id}`} className="post-card-link">
        {post.coverUrl ? (
          <img src={post.coverUrl} alt="" className="post-cover" loading="lazy" />
        ) : (
          <div className="post-cover post-cover-empty" aria-hidden="true">
            <span>{post.category}</span>
          </div>
        )}
        <div className="post-card-body">
          <p className="post-meta">{postMeta(post)}</p>
          <h3>{post.title}</h3>
          {post.summary && <p className="post-summary">{post.summary}</p>}
          <div className="chips">
            {post.status === 'draft' && <span className="chip chip-warn">Draft: only the committee sees this</span>}
            {post.membersOnly && <span className="chip">Members only</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}

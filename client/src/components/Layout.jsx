import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { isCommittee } from '../auth/permissions.js';
import { usePendingCount } from '../hooks/usePendingCount.js';
import { useUnreadCount } from '../hooks/useUnreadCount.js';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pendingCount = usePendingCount(user);
  const unreadCount = useUnreadCount(user);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="site">
      <header className="site-header">
        <div className="container header-row">
          <Link to="/" className="brand">
            {/* The school badge (client/public/badge.png) */}
            <img src="/badge.png" alt="" className="brand-badge" width="46" height="46" />
            <span className="brand-text">
              <span className="brand-name">Vishaka OGA</span>
              <span className="brand-sub">Bandarawela · Colombo · Kandy</span>
            </span>
          </Link>
          <nav className="main-nav" aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/news">News</NavLink>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/history">History</NavLink>
            {user && <NavLink to="/funds">Funds</NavLink>}
            {user && <NavLink to="/card">My card</NavLink>}
            {isCommittee(user) && (
              <NavLink to="/committee" className="nav-with-badge">
                Committee
                {pendingCount > 0 && (
                  <span className="nav-badge" aria-label={`${pendingCount} registrations waiting`}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </NavLink>
            )}
            {user ? (
              <>
                <NavLink to="/notifications" className="nav-bell"
                  aria-label={unreadCount ? `Notifications, ${unreadCount} new` : 'Notifications'}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {unreadCount > 0 && <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </NavLink>
                <span className="nav-user">Hi, {user.fullName.split(' ')[0]}</span>
                <button type="button" className="btn btn-outline-light" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Log in</NavLink>
                <Link to="/register" className="btn btn-gold">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-row">
          <span>Vishaka Vidyalaya OGA · Bandarawela · Colombo · Kandy</span>
          <span>
            <Link to="/batches">Batch wall</Link> · <Link to="/history">Our story</Link> · Questions? Contact your branch coordinator.
          </span>
        </div>
      </footer>
    </div>
  );
}

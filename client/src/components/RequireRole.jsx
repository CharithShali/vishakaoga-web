import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { hasRole } from '../auth/permissions.js';

// Wrap a page so only logged-in users (optionally with certain roles) can see it.
export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="container muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !hasRole(user, roles)) {
    return (
      <div className="container page">
        <h1>Committee only</h1>
        <p>This page is for committee members. If you think you should see it, contact the Secretary.</p>
      </div>
    );
  }
  return children;
}

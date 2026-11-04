import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/branches')
      .then((data) => setBranches(data.branches))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <h1>Welcome to the Visakha OGA</h1>
          <p className="hero-lead">
            One school, three cities. Whether you studied in Kandy, Bandarawela or Colombo,
            register once and stay close to your batch and your branch.
          </p>
          {!user && (
            <div className="hero-actions">
              <Link to="/register" className="btn btn-gold btn-lg">Register as a member</Link>
              <Link to="/login" className="btn btn-outline-light btn-lg">Log in</Link>
            </div>
          )}
        </div>
      </section>

      <section className="container page">
        <p className="eyebrow">Our branches</p>
        <h2>One school, three cities</h2>
        {error && <p className="alert alert-error">Could not load branches: {error}</p>}
        <div className="grid grid-3">
          {branches.map((b) => (
            <article key={b._id} className="card branch-card">
              <h3>{b.name}</h3>
              <p className="muted">Branch code {b.code}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES, ROLE_LABELS, hasRole, isAdmin, roleText } from '../auth/permissions.js';

const VIEW_ROLES = ['secretary', 'coordinator'];

export default function CommitteePage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canViewMembers = hasRole(user, VIEW_ROLES);
  const admin = isAdmin(user);

  // Branch tabs: only the branches this person is allowed to see.
  const visibleBranches = branches.filter((b) => hasRole(user, VIEW_ROLES, b._id));
  const seesAllBranches = visibleBranches.length === branches.length;

  useEffect(() => {
    api('/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  // A branch coordinator starts on her own branch tab.
  useEffect(() => {
    if (!seesAllBranches && branchFilter === '' && visibleBranches.length > 0) {
      setBranchFilter(visibleBranches[0]._id);
    }
  }, [seesAllBranches, branchFilter, visibleBranches]);

  useEffect(() => {
    if (!canViewMembers) return;
    setLoading(true);
    setError('');
    const query = branchFilter ? `?branch=${branchFilter}` : '';
    api(`/users${query}`)
      .then((d) => setMembers(d.users))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [branchFilter, canViewMembers]);

  async function saveRoles(memberId, roles) {
    setError('');
    try {
      const body = { roles: roles.map((r) => ({ name: r.name, branch: r.branch?._id ?? r.branch ?? null })) };
      const { user: updated } = await api(`/users/${memberId}/roles`, { method: 'PUT', body });
      setMembers((list) => list.map((m) => (m._id === updated._id ? updated : m)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container page">
      <h1>Committee area</h1>
      <div className="chips">
        {user.roles.map((r, i) => (
          <span key={i} className="chip chip-navy">{roleText(r)}</span>
        ))}
      </div>

      {!canViewMembers ? (
        <p className="card">
          Member lists are for the Secretary and branch coordinators. Your other tools
          (fund records, event scanning) arrive in the next steps.
        </p>
      ) : (
        <section className="card section">
          <div className="section-head">
            <h2>Members &amp; committee roles</h2>
            <div className="tabs" role="group" aria-label="Branch">
              {seesAllBranches && (
                <button type="button" className={branchFilter === '' ? 'tab active' : 'tab'}
                  onClick={() => setBranchFilter('')}>All branches</button>
              )}
              {visibleBranches.map((b) => (
                <button key={b._id} type="button"
                  className={branchFilter === b._id ? 'tab active' : 'tab'}
                  onClick={() => setBranchFilter(b._id)}>{b.name}</button>
              ))}
            </div>
          </div>

          {!admin && (
            <p className="muted small">Only the main admin can change committee roles.</p>
          )}
          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Batch</th>
                  <th>Profession</th>
                  <th>Email</th>
                  <th>Committee roles</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="6" className="muted">Loading…</td></tr>
                )}
                {!loading && members.length === 0 && (
                  <tr><td colSpan="6" className="muted">No members yet.</td></tr>
                )}
                {!loading && members.map((m) => (
                  <tr key={m._id}>
                    <td className="strong">{m.fullName}</td>
                    <td>{m.branch?.name}</td>
                    <td>{m.batchYear || '—'}</td>
                    <td>
                      {m.profession?.title || m.profession?.category || '—'}
                      {m.profession?.workplace && (
                        <div className="muted small">{m.profession.workplace}</div>
                      )}
                    </td>
                    <td className="muted">{m.email}</td>
                    <td>
                      <RoleCell member={m} branches={branches} editable={admin}
                        onSave={(roles) => saveRoles(m._id, roles)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function RoleCell({ member, branches, editable, onSave }) {
  const [name, setName] = useState('coordinator');
  const [branch, setBranch] = useState('');

  function add() {
    const next = [...member.roles, { name, branch: name === 'admin' ? null : branch || null }];
    onSave(next);
  }

  function remove(index) {
    onSave(member.roles.filter((_, i) => i !== index));
  }

  return (
    <div className="role-cell">
      <div className="chips">
        {member.roles.length === 0 && <span className="muted small">Member</span>}
        {member.roles.map((r, i) => (
          <span key={i} className="chip">
            {roleText(r)}
            {editable && (
              <button type="button" className="chip-remove" aria-label={`Remove ${roleText(r)}`}
                onClick={() => remove(i)}>×</button>
            )}
          </span>
        ))}
      </div>
      {editable && (
        <div className="role-add">
          <select aria-label="Role" value={name} onChange={(e) => setName(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <select aria-label="Branch for this role" value={branch}
            onChange={(e) => setBranch(e.target.value)} disabled={name === 'admin'}>
            <option value="">All branches</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <button type="button" className="btn btn-small" onClick={add}>Add role</button>
        </div>
      )}
    </div>
  );
}

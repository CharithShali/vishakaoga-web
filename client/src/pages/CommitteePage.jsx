import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES, ROLE_LABELS, hasRole, isAdmin, roleText } from '../auth/permissions.js';
import PendingRegistrations from '../components/PendingRegistrations.jsx';
import { SCHOOL_ROLES } from '../options.js';

const VIEW_ROLES = ['secretary', 'coordinator'];

export default function CommitteePage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [statusView, setStatusView] = useState('active'); // 'active' or 'suspended' (removed)
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0); // bump to reload the member list
  const [search, setSearch] = useState(''); // what is typed in the search box
  const [query, setQuery] = useState(''); // the same, after a short pause in typing
  const [roleFilter, setRoleFilter] = useState('');
  const [total, setTotal] = useState(0);

  // Search 300 ms after she stops typing, not on every key.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const canViewMembers = hasRole(user, VIEW_ROLES);
  const admin = isAdmin(user);
  const showingRemoved = statusView === 'suspended';

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
    const params = new URLSearchParams({ status: statusView });
    if (branchFilter) params.set('branch', branchFilter);
    if (query) params.set('q', query);
    if (roleFilter) params.set('role', roleFilter);
    api(`/users?${params}`)
      .then((d) => {
        setMembers(d.users);
        setTotal(d.total ?? d.users.length);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [branchFilter, statusView, query, roleFilter, canViewMembers, reloadKey]);

  async function run(action, successMessage) {
    setError('');
    setNotice('');
    try {
      const res = await action();
      setNotice(successMessage(res));
      setReloadKey((k) => k + 1);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

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

  const removeMember = (m, reason) =>
    run(() => api(`/users/${m._id}/remove`, { method: 'POST', body: { reason } }),
      () => `${m.fullName}'s membership was removed. You can restore it under "Removed members".`);
  const restoreMember = (m) =>
    run(() => api(`/users/${m._id}/restore`, { method: 'POST' }),
      () => `${m.fullName} is an active member again. Add committee roles again if she needs them.`);
  const deleteMember = (m) =>
    run(() => api(`/users/${m._id}`, { method: 'DELETE' }),
      () => `${m.fullName} was deleted permanently, with her photo.`);

  const columns = showingRemoved ? 6 : admin ? 7 : 6;

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Committee area</h1>
        {hasRole(user, ['secretary', 'treasurer']) && (
          <Link to="/committee/fees" className="btn btn-gold">Membership fees</Link>
        )}
      </div>
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
        <>
        <div className="tabs tabs-bar" role="group" aria-label="Branch">
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

        <PendingRegistrations branchFilter={branchFilter}
          onReviewed={() => setReloadKey((k) => k + 1)} />

        <section className="card section">
          <div className="section-head">
            <h2>{showingRemoved ? 'Removed members' : 'Members & committee roles'}</h2>
            {admin && (
              <div className="tabs" role="group" aria-label="Which members">
                <button type="button" className={!showingRemoved ? 'tab active' : 'tab'}
                  onClick={() => setStatusView('active')}>Members</button>
                <button type="button" className={showingRemoved ? 'tab active' : 'tab'}
                  onClick={() => setStatusView('suspended')}>Removed members</button>
              </div>
            )}
          </div>

          <div className="member-search" role="search">
            <label className="field search-field">
              Search
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, member number (e.g. COL-2016) or batch year" />
            </label>
            <label className="field">
              Role
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">Any role</option>
                <optgroup label="Committee roles">
                  <option value="committee:any">Any committee role</option>
                  {ROLES.map((r) => <option key={r} value={`committee:${r}`}>{ROLE_LABELS[r]}</option>)}
                </optgroup>
                <optgroup label="Roles at school">
                  {SCHOOL_ROLES.map((r) => <option key={r} value={`school:${r}`}>{r}</option>)}
                </optgroup>
              </select>
            </label>
            {(search || roleFilter) && (
              <button type="button" className="btn btn-small" onClick={() => { setSearch(''); setRoleFilter(''); }}>
                Clear
              </button>
            )}
            <span className="muted small search-count">
              {loading ? 'Searching…' : `${total} ${total === 1 ? 'member' : 'members'}${total > members.length ? ` (showing first ${members.length})` : ''}`}
            </span>
          </div>

          {!admin && (
            <p className="muted small">Only the main admin can change committee roles or remove members.</p>
          )}
          {notice && <p className="alert alert-ok" role="status">{notice}</p>}
          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Batch</th>
                  {showingRemoved ? (
                    <>
                      <th>Removed</th>
                      <th>Reason</th>
                    </>
                  ) : (
                    <>
                      <th>Profession</th>
                      <th>Email</th>
                      <th>Committee roles</th>
                    </>
                  )}
                  {admin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={columns} className="muted">Loading…</td></tr>
                )}
                {!loading && members.length === 0 && (
                  <tr><td colSpan={columns} className="muted">
                    {query || roleFilter
                      ? 'No members match your search.'
                      : showingRemoved ? 'No removed members.' : 'No members yet.'}
                  </td></tr>
                )}
                {!loading && members.map((m) => (
                  <tr key={m._id}>
                    <td className="strong">
                      {m.fullName}
                      {m.memberNo && <div className="muted small">{m.memberNo}</div>}
                      {m.schoolRoles?.length > 0 && (
                        <div className="school-roles small">{m.schoolRoles.join(' · ')}</div>
                      )}
                    </td>
                    <td>{m.branch?.name}</td>
                    <td>{m.batchYear || '—'}</td>
                    {showingRemoved ? (
                      <>
                        <td>
                          {m.removal?.at ? new Date(m.removal.at).toLocaleDateString() : '—'}
                          {m.removal?.by?.fullName && (
                            <div className="muted small">by {m.removal.by.fullName}</div>
                          )}
                        </td>
                        <td>{m.removal?.reason || '—'}</td>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                    {admin && (
                      <td>
                        {showingRemoved ? (
                          <RemovedActions member={m} onRestore={restoreMember} onDelete={deleteMember} />
                        ) : m._id === user._id ? (
                          <span className="muted small">You</span>
                        ) : (
                          <RemoveAction member={m} onRemove={removeMember} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>
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
              <button type="button" className="chip-remove" title="Remove this role"
                aria-label={`Remove role: ${roleText(r)}`} onClick={() => remove(i)}>×</button>
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
          {member.roles.length > 1 && (
            <button type="button" className="btn btn-small" onClick={() => onSave([])}>
              Remove all roles
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// "Remove membership…" → asks for a reason, then removes.
function RemoveAction({ member, onRemove }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn btn-small" onClick={() => setOpen(true)}>
        Remove membership…
      </button>
    );
  }

  async function confirm() {
    setBusy(true);
    const ok = await onRemove(member, reason);
    if (!ok) setBusy(false);
  }

  return (
    <div className="inline-confirm">
      <label className="field small-field">
        Reason
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Asked to leave the association" />
      </label>
      <p className="muted small">She won't be able to log in, and her committee roles are cleared.</p>
      <div className="row-actions">
        <button type="button" className="btn btn-small btn-danger" onClick={confirm}
          disabled={busy || reason.trim().length < 3}>Remove</button>
        <button type="button" className="btn btn-small" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// For removed members: Restore, or Delete permanently (asks twice).
function RemovedActions({ member, onRestore, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(fn) {
    setBusy(true);
    const ok = await fn(member);
    if (!ok) setBusy(false);
  }

  if (confirmDelete) {
    return (
      <div className="inline-confirm">
        <p className="small">
          Delete {member.fullName} and her photo for good? This can't be undone.
        </p>
        <div className="row-actions">
          <button type="button" className="btn btn-small btn-danger" onClick={() => act(onDelete)}
            disabled={busy}>Yes, delete</button>
          <button type="button" className="btn btn-small" onClick={() => setConfirmDelete(false)}
            disabled={busy}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="row-actions">
      <button type="button" className="btn btn-small" onClick={() => act(onRestore)} disabled={busy}>
        Restore
      </button>
      <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirmDelete(true)}
        disabled={busy}>Delete permanently…</button>
    </div>
  );
}

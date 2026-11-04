// Committee roles. Every approved (active) user is a member; these are extra jobs.
// A role either covers ALL branches (branch = null, e.g. the central Secretary)
// or ONE branch (e.g. the Kandy coordinator).
export const ROLES = ['admin', 'coordinator', 'secretary', 'treasurer', 'eventHelper'];

export const ROLE_LABELS = {
  admin: 'Main admin',
  coordinator: 'Branch coordinator',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  eventHelper: 'Event helper',
};

// A role's branch may be an ObjectId, a string, a populated branch object or null.
function branchIdOf(role) {
  const b = role.branch;
  if (b == null) return null;
  return String(b._id ?? b);
}

/**
 * Does the user hold one of `roleNames` for `branchId`?
 * - The main admin can do everything.
 * - A role with no branch covers every branch.
 * - If branchId is null, holding the role for any branch is enough.
 */
export function hasRole(user, roleNames, branchId = null) {
  if (!user?.roles) return false;
  return user.roles.some((role) => {
    if (role.name === 'admin') return true;
    if (!roleNames.includes(role.name)) return false;
    const roleBranch = branchIdOf(role);
    if (roleBranch === null || branchId == null) return true;
    return roleBranch === String(branchId);
  });
}

/**
 * Which branches can the user act on with these roles?
 * Returns 'all', or an array of branch id strings (empty = none).
 */
export function branchScope(user, roleNames) {
  if (!user?.roles) return [];
  const ids = new Set();
  for (const role of user.roles) {
    if (role.name === 'admin') return 'all';
    if (!roleNames.includes(role.name)) continue;
    const roleBranch = branchIdOf(role);
    if (roleBranch === null) return 'all';
    ids.add(roleBranch);
  }
  return [...ids];
}

export function isCommittee(user) {
  return Boolean(user?.roles?.some((role) => ROLES.includes(role.name)));
}

export function isAdmin(user) {
  return Boolean(user?.roles?.some((role) => role.name === 'admin'));
}

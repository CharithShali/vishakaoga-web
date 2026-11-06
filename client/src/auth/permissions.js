// Same rules as server/src/utils/permissions.js. The server always has the final
// say; these copies only decide what the page shows (menus, buttons).
export const ROLES = ['admin', 'coordinator', 'secretary', 'treasurer', 'eventHelper'];

export const ROLE_LABELS = {
  admin: 'Main admin',
  coordinator: 'Branch coordinator',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  eventHelper: 'Event helper',
};

function branchIdOf(role) {
  const b = role.branch;
  if (b == null) return null;
  return String(b._id ?? b);
}

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

export function isCommittee(user) {
  return Boolean(user?.roles?.some((role) => ROLES.includes(role.name)));
}

export function isAdmin(user) {
  return Boolean(user?.roles?.some((role) => role.name === 'admin'));
}

// "Branch coordinator · Kandy" or "Secretary · All branches"
export function roleText(role) {
  const label = ROLE_LABELS[role.name] || role.name;
  if (role.name === 'admin') return label;
  return `${label} · ${role.branch?.name || 'All branches'}`;
}

// Which branches can the user act on with these roles? 'all' or a list of branch ids.
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

// Events (same rules as server/src/utils/eventPermissions.js)
export const MANAGE_EVENT_ROLES = ['coordinator', 'secretary'];
export const CHECKIN_ROLES = ['eventHelper', 'coordinator', 'secretary'];

// branchId null/'' = a joint event for all branches, which needs a central role.
export function canManageEvent(user, branchId) {
  if (!branchId) return branchScope(user, MANAGE_EVENT_ROLES) === 'all';
  return hasRole(user, MANAGE_EVENT_ROLES, branchId);
}

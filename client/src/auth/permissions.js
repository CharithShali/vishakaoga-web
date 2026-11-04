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

import { hasRole, branchScope } from './permissions.js';

// Who writes news posts (and uploads their pictures): branch coordinators for
// their branch, the Secretary (her branch, or all if central) and the main admin.
// Same people who manage events.
export const POST_ROLES = ['coordinator', 'secretary'];

// History page editors: the central Secretary and the main admin.
export const HISTORY_ROLES = ['secretary'];

const idOf = (branch) => (branch == null ? null : String(branch._id ?? branch));

/** Write or change a post for this branch (null = for all branches: central roles only). */
export function canManagePost(user, branch) {
  const id = idOf(branch);
  if (id === null) return branchScope(user, POST_ROLES) === 'all';
  return hasRole(user, POST_ROLES, id);
}

/** Edit the history page (the school story, committee lists, roll of honour). */
export function canEditHistory(user) {
  return branchScope(user, HISTORY_ROLES) === 'all';
}

/**
 * MongoDB condition for drafts this person may see (her own scope), or null
 * when she can't see any drafts.
 */
export function draftCondition(user) {
  const scope = branchScope(user, POST_ROLES);
  if (scope === 'all') return { status: 'draft' };
  if (!scope.length) return null;
  return { status: 'draft', branch: { $in: scope } };
}

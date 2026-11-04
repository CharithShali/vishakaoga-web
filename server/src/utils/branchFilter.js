import { branchScope } from './permissions.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Build the MongoDB branch condition for a committee list.
 * - roles: the roles that may view this list (e.g. ['secretary', 'coordinator'])
 * - requested: optional branch id from the query string
 * Returns { branch } to merge into a filter (or {} for all branches),
 * or { error, status } to send back to the browser.
 */
export function scopedBranchFilter(user, roles, requested) {
  const scope = branchScope(user, roles);
  const wanted = requested ? String(requested) : null;

  if (wanted && !OBJECT_ID.test(wanted)) {
    return { error: 'Unknown branch.', status: 400 };
  }
  if (scope === 'all') return wanted ? { branch: wanted } : {};
  if (wanted) {
    if (!scope.includes(wanted)) {
      return { error: 'You can only see your own branch.', status: 403 };
    }
    return { branch: wanted };
  }
  return { branch: { $in: scope } };
}

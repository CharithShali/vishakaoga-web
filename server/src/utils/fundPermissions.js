import { hasRole, branchScope } from './permissions.js';

export const TREASURER_ROLES = ['treasurer'];

const idOf = (branch) => (branch == null ? null : String(branch._id ?? branch));

/**
 * Record or correct money for this branch (null = central / association-wide).
 * A branch treasurer handles her own branch; central records need a central
 * treasurer or the main admin.
 */
export function canRecordMoney(user, branch) {
  const id = idOf(branch);
  if (id === null) return branchScope(user, TREASURER_ROLES) === 'all';
  return hasRole(user, TREASURER_ROLES, id);
}

/** Add funds or change their goals: central treasurer or main admin. */
export function canManageFunds(user) {
  return branchScope(user, TREASURER_ROLES) === 'all';
}

/**
 * Turn the branch filter into a MongoDB condition.
 *   ''        everything (all branches and central)
 *   'central' central records only
 *   <id>      that branch only
 */
export function branchCondition(value) {
  if (!value) return {};
  if (value === 'central') return { branch: null };
  if (/^[a-f0-9]{24}$/i.test(value)) return { branch: value };
  return null; // not valid
}

/** Year filter on the "YYYY-MM-DD" date text. 'all' or empty = no filter. */
export function yearCondition(value) {
  if (!value || value === 'all') return {};
  if (!/^\d{4}$/.test(String(value))) return null;
  return { date: { $gte: `${value}-01-01`, $lte: `${value}-12-31` } };
}

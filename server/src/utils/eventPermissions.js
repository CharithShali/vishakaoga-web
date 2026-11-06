import { hasRole, branchScope } from './permissions.js';

// Who can create, edit and delete events
export const MANAGE_EVENT_ROLES = ['coordinator', 'secretary'];
// Who can scan cards at the gate and see who is coming / came
export const CHECKIN_ROLES = ['eventHelper', 'coordinator', 'secretary'];

const idOf = (branch) => (branch == null ? null : String(branch._id ?? branch));

/**
 * Create or edit an event for this branch (null = joint event for all branches).
 * A branch coordinator manages her own branch's events; joint events need a
 * central role (e.g. the central Secretary) or the main admin.
 */
export function canManageEvent(user, branch) {
  const id = idOf(branch);
  if (id === null) return branchScope(user, MANAGE_EVENT_ROLES) === 'all';
  return hasRole(user, MANAGE_EVENT_ROLES, id);
}

/**
 * Scan cards and see attendee lists. For a branch event: helpers of that branch
 * (or central ones). For a joint event: any helper from any branch.
 */
export function canCheckIn(user, branch) {
  return hasRole(user, CHECKIN_ROLES, idOf(branch));
}

/** What the QR code (or the helper typing) gives → a member number to look up. */
export function normaliseMemberNo(text) {
  return String(text || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

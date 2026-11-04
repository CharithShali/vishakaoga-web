import { ROLES } from './permissions.js';
import { SCHOOL_ROLES } from './options.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Turn the search box and role filter into MongoDB conditions.
 *   q:    a name, a member number (or part of one, e.g. "COL-2016"), an email, or a batch year
 *   role: "committee:any", "committee:<role>" or "school:<role>"
 * Returns { filter } to merge into the query, or { error } for a bad role.
 */
export function buildMemberSearch(q, role) {
  const filter = {};

  const text = String(q || '').trim().slice(0, 80);
  if (text) {
    const rx = new RegExp(escapeRegex(text), 'i');
    const or = [{ fullName: rx }, { nameAtSchool: rx }, { memberNo: rx }, { email: rx }];
    if (/^\d{4}$/.test(text)) or.push({ batchYear: Number(text) });
    filter.$or = or;
  }

  const r = String(role || '');
  if (r === 'committee:any') {
    filter['roles.0'] = { $exists: true };
  } else if (r.startsWith('committee:')) {
    const name = r.slice('committee:'.length);
    if (!ROLES.includes(name)) return { error: 'Unknown role.' };
    filter['roles.name'] = name;
  } else if (r.startsWith('school:')) {
    const name = r.slice('school:'.length);
    if (!SCHOOL_ROLES.includes(name)) return { error: 'Unknown school role.' };
    filter.schoolRoles = name;
  } else if (r) {
    return { error: 'Unknown role.' };
  }

  return { filter };
}

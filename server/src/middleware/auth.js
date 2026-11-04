import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { hasRole } from '../utils/permissions.js';

export const AUTH_COOKIE = 'oga_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: '7d' });
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true, // JavaScript in the page can't read it
    secure: env.isProd, // HTTPS only on the live site
    sameSite: 'lax',
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, secure: env.isProd, sameSite: 'lax' });
}

// Runs on every /api request: if a valid login cookie is present and the
// account is still active, put the user on req.user.
export async function loadUser(req, _res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return next();
  try {
    const { sub } = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(sub);
    if (user && user.status === 'active') req.user = user;
  } catch {
    // Expired or tampered token: treat as logged out.
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

// Allow the request only if the user holds one of these roles (for any branch).
// Routes that touch one branch's data must also check that branch, using
// hasRole(req.user, roles, branchId) or branchScope().
export function requireRole(...roleNames) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
    if (!hasRole(req.user, roleNames)) {
      return res.status(403).json({ error: "You don't have permission to do that." });
    }
    next();
  };
}

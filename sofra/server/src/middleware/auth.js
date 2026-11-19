import crypto from 'crypto';
import { HttpError } from './errorHandler.js';

// Simple shared-secret protection for the admin API. The secret must be configured
// in the backend environment and is never bundled into the browser.
export const isAdminPasswordConfigured = () => Boolean(process.env.ADMIN_PASSWORD);
const adminPassword = () => process.env.ADMIN_PASSWORD;

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
export const isValidAdminKey = (key) => isAdminPasswordConfigured() && typeof key === 'string' && crypto.timingSafeEqual(digest(key), digest(adminPassword()));

export function requireAdmin(req, res, next) {
  if (!isAdminPasswordConfigured()) return next(new HttpError(503, 'Admin authentication is not configured'));
  if (!isValidAdminKey(req.get('x-admin-key'))) {
    return next(new HttpError(401, 'Admin access required. Please sign in at /admin.'));
  }
  next();
}

export async function adminLogin(req, res, next) {
  if (!isAdminPasswordConfigured()) return next(new HttpError(503, 'Admin authentication is not configured'));
  if (!isValidAdminKey(req.body?.password)) {
    await new Promise((r) => setTimeout(r, 500)); // slow down guessing
    const submittedPasswordLength = typeof req.body?.password === 'string' ? req.body.password.length : null;
    return next(new HttpError(401, 'Incorrect admin password', {
      diagnostic: {
        adminPasswordConfigured: isAdminPasswordConfigured(),
        submittedPasswordLength,
      },
    }));
  }
  res.json({ ok: true });
}

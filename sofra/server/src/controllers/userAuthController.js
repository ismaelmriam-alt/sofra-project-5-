import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { HttpError } from '../middleware/errorHandler.js';
import { getJwtSecret, signUserToken } from '../middleware/userAuth.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

function validateCredentials({ name, email, password }, includeName = false) {
  const details = {};
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (includeName && (!normalizedName || normalizedName.length > 80)) {
    details.name = 'Name is required and must be at most 80 characters';
  }
  if (!normalizedEmail || normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    details.email = 'Enter a valid email address';
  }
  if (
    typeof password !== 'string'
    || password.length < 8
    || Buffer.byteLength(password, 'utf8') > 72
  ) {
    details.password = 'Password must be at least 8 characters and no more than 72 UTF-8 bytes';
  }
  if (Object.keys(details).length) throw new HttpError(400, 'Validation failed', details);

  return { name: normalizedName, email: normalizedEmail, password };
}

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function registerUser(req, res) {
  const { name, email, password } = validateCredentials(req.body || {}, true);
  getJwtSecret();

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email, passwordHash, role: 'customer' });
  res.status(201).json({ user: publicUser(user), token: signUserToken(user) });
}

export async function loginUser(req, res) {
  const { email, password } = validateCredentials(req.body || {});
  getJwtSecret();

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json({ user: publicUser(user), token: signUserToken(user) });
}

export async function getCurrentUser(req, res) {
  const user = await User.findById(req.auth.userId).select('name email role createdAt');
  if (!user) throw new HttpError(401, 'Authentication required');
  res.json({ user: publicUser(user) });
}

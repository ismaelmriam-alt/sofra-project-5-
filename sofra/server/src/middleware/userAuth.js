import jwt from 'jsonwebtoken';
import { HttpError } from './errorHandler.js';

const TOKEN_ISSUER = 'sofra-api';
const TOKEN_AUDIENCE = 'sofra-client';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes');
  }
  return secret;
}

export function signUserToken(user) {
  return jwt.sign({}, getJwtSecret(), {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn: '1h',
  });
}

export function requireUser(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
  if (!match) return next(new HttpError(401, 'Authentication required'));

  const secret = getJwtSecret();
  try {
    const claims = jwt.verify(match[1], secret, {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    if (typeof claims === 'string' || !claims.sub) {
      return next(new HttpError(401, 'Invalid or expired authentication token'));
    }
    req.auth = { userId: claims.sub };
    return next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new HttpError(401, 'Invalid or expired authentication token'));
    }
    return next(err);
  }
}

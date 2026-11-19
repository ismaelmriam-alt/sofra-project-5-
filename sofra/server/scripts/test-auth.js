import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import { getJwtSecret } from '../src/middleware/userAuth.js';

let passed = 0;
let failed = 0;
const check = (name, condition) => {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✖ ${name}`);
  }
};

const configuredSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const db = await MongoMemoryServer.create();
let server;

try {
  await mongoose.connect(db.getUri('sofra-auth-test'));
  server = await new Promise((resolve) => {
    const appServer = createApp().listen(0, () => resolve(appServer));
  });
  const base = `http://localhost:${server.address().port}/api`;
  const request = async (method, path, body, token) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await response.json(); } catch { /* empty response */ }
    return { status: response.status, data };
  };

  console.log('User registration and login');
  const email = ' TEST.User@Example.COM ';
  const password = 'TestPassword!123';
  const invalid = await request('POST', '/auth/register', { name: '', email: 'invalid', password: 'short' });
  check('invalid registration rejected with 400', invalid.status === 400);

  const registration = await request('POST', '/auth/register', {
    name: ' Test User ',
    email,
    password,
    role: 'admin',
  });
  const user = registration.data?.user;
  check('registration succeeds and assigns customer role', registration.status === 201 && user?.role === 'customer');
  check('registration normalizes name and email', user?.name === 'Test User' && user?.email === 'test.user@example.com');
  check('registration response excludes password hash', user && !Object.prototype.hasOwnProperty.call(user, 'passwordHash'));
  check('registration returns a JWT', typeof registration.data?.token === 'string');

  const savedUser = await User.findById(user?._id).select('+passwordHash');
  check('password stored as bcrypt hash', Boolean(savedUser && savedUser.passwordHash !== password && await bcrypt.compare(password, savedUser.passwordHash)));

  const duplicate = await request('POST', '/auth/register', { name: 'Other', email: email.toLowerCase().trim(), password });
  check('duplicate normalized email rejected with 409', duplicate.status === 409);

  const badLogin = await request('POST', '/auth/login', { email: email.toLowerCase().trim(), password: 'wrong-password' });
  check('incorrect login rejected with 401', badLogin.status === 401);
  const login = await request('POST', '/auth/login', { email: email.toLowerCase().trim(), password });
  check('login succeeds and returns a JWT', login.status === 200 && typeof login.data?.token === 'string');
  check('login response excludes password hash', login.data?.user && !Object.prototype.hasOwnProperty.call(login.data.user, 'passwordHash'));

  const anonymous = await request('GET', '/auth/me');
  check('current-user route rejects missing token', anonymous.status === 401);
  const invalidToken = await request('GET', '/auth/me', undefined, 'invalid.token.value');
  check('current-user route rejects invalid token', invalidToken.status === 401);
  const currentUser = await request('GET', '/auth/me', undefined, login.data?.token);
  check('current-user route accepts JWT and returns safe user', currentUser.status === 200 && currentUser.data?.user?._id === user?._id && !Object.prototype.hasOwnProperty.call(currentUser.data?.user || {}, 'passwordHash'));

  const secret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  let missingSecretRejected = false;
  try { getJwtSecret(); } catch { missingSecretRejected = true; }
  process.env.JWT_SECRET = secret;
  check('JWT secret has no hardcoded fallback', missingSecretRejected);
} catch (error) {
  failed++;
  console.error('  ✖ Authentication test setup or request failed:', error);
} finally {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await db.stop();
  if (configuredSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = configuredSecret;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;

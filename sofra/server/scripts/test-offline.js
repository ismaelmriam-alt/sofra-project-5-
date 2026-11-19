// Tests that need NO database: admin protection, login, image upload rules, and Dish model validation.
//   npm run test:offline          (from /server)
// Starts the real Express app on a random port. The CRUD-with-MongoDB checks live in smoke-test.js.
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { createApp } from '../src/app.js';
import Dish from '../src/models/Dish.js';
import User from '../src/models/User.js';
import { getJwtSecret } from '../src/middleware/userAuth.js';
import mongoose from 'mongoose';
import { DISH_IMAGES_DIR } from '../src/config/paths.js';

process.env.ADMIN_PASSWORD ||= 'sofra2026';
process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`  ${cond ? '✔' : '✖'} ${name} ${cond ? '' : extra}`); };

const server = createApp().listen(0);
const base = `http://localhost:${server.address().port}`;
const KEY = { 'x-admin-key': process.env.ADMIN_PASSWORD };
const j = (method, p, body, headers = {}) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
const fakeId = '64b7f0f0f0f0f0f0f0f0f0f0';

console.log('Customers cannot change the menu or read admin data (no admin key)');
for (const [m, p] of [['POST', '/api/dishes'], ['PUT', `/api/dishes/${fakeId}`], ['DELETE', `/api/dishes/${fakeId}`], ['POST', '/api/categories'], ['PUT', `/api/categories/${fakeId}`], ['DELETE', `/api/categories/${fakeId}`], ['GET', '/api/orders'], ['GET', '/api/orders/stats'], ['PATCH', `/api/orders/${fakeId}/status`], ['DELETE', `/api/orders/${fakeId}`], ['POST', '/api/uploads/dish-image'], ['GET', '/api/admin/verify']]) {
  const r = await j(m, p, m === 'GET' || m === 'DELETE' ? undefined : {});
  check(`${m} ${p.replace(fakeId, ':id')} → 401`, r.status === 401, `got ${r.status}`);
}
const wrong = await j('POST', '/api/dishes', {}, { 'x-admin-key': 'nope' });
check('wrong key → 401', wrong.status === 401);

console.log('Customers can still order (route is public)');
const ord = await j('POST', '/api/orders', {});
check('POST /api/orders is not blocked (validation error, not 401)', ord.status === 400, `got ${ord.status}`);

console.log('Admin login');
const bad = await j('POST', '/api/admin/login', { password: 'wrong' });
check('wrong password → 401', bad.status === 401);
const good = await j('POST', '/api/admin/login', { password: process.env.ADMIN_PASSWORD });
check('correct password → 200', good.status === 200);
check('verify with key → 200', (await j('GET', '/api/admin/verify', undefined, KEY)).status === 200);

console.log('User authentication');
const user = new User({ name: ' Test User ', email: ' TEST@EXAMPLE.COM ', passwordHash: 'test-hash' });
check('user email normalized and role defaults to customer', user.email === 'test@example.com' && user.role === 'customer');
check('password hash excluded from default queries', User.schema.path('passwordHash').options.select === false);
const configuredSecret = process.env.JWT_SECRET;
delete process.env.JWT_SECRET;
let missingSecretRejected = false;
try { getJwtSecret(); } catch { missingSecretRejected = true; }
process.env.JWT_SECRET = configuredSecret;
check('JWT secret has no hardcoded fallback', missingSecretRejected);
const invalidRegistration = await j('POST', '/api/auth/register', { name: '', email: 'bad-email', password: 'short' });
check('invalid registration rejected (400)', invalidRegistration.status === 400);
check('current-user route requires a token', (await j('GET', '/api/auth/me')).status === 401);
check('invalid user token rejected (401)', (await j('GET', '/api/auth/me', undefined, { authorization: 'Bearer invalid.token.value' })).status === 401);

console.log('Image upload');
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const up = (buf, type, name) => { const f = new FormData(); f.append('image', new Blob([buf], { type }), name); return fetch(base + '/api/uploads/dish-image', { method: 'POST', headers: KEY, body: f }); };
const before = fs.existsSync(DISH_IMAGES_DIR) ? fs.readdirSync(DISH_IMAGES_DIR).length : 0;
const okUp = await up(png, 'image/png', 'My Hummus!.png');
const okBody = await okUp.json();
check('valid image → 201 with a path', okUp.status === 201 && /^\/assets\/images\/dishes\/upload-my-hummus-.+\.png$/.test(okBody.path), JSON.stringify(okBody));
check('file saved in public/assets/images/dishes', fs.existsSync(path.join(DISH_IMAGES_DIR, path.basename(okBody.path || 'x'))));
const served = await fetch(base + okBody.path);
check('uploaded image is served by Express', served.status === 200 && (served.headers.get('content-type') || '').startsWith('image/'));
const txt = await up(Buffer.from('hello'), 'text/plain', 'a.txt');
check('non-image type rejected (400)', txt.status === 400);
const fake = await up(Buffer.from('this is not a png at all'), 'image/png', 'fake.png');
check('fake image bytes rejected (400)', fake.status === 400);
const big = await up(Buffer.concat([png, Buffer.alloc(5.5 * 1024 * 1024)]), 'image/png', 'big.png');
check('file over 5 MB rejected (400)', big.status === 400);
const noFile = await fetch(base + '/api/uploads/dish-image', { method: 'POST', headers: KEY, body: new FormData() });
check('missing file rejected (400)', noFile.status === 400);
const leftovers = fs.readdirSync(DISH_IMAGES_DIR).filter((f) => f.startsWith('upload-'));
check('rejected uploads leave no files behind', leftovers.length === 1, leftovers.join(','));
for (const f of leftovers) fs.unlinkSync(path.join(DISH_IMAGES_DIR, f));
if (before === 0 && fs.existsSync(DISH_IMAGES_DIR) && fs.readdirSync(DISH_IMAGES_DIR).length === 0) fs.rmSync(DISH_IMAGES_DIR, { recursive: true });

console.log('Dish model validation (Arabic name, image rules)');
const cat = new mongoose.Types.ObjectId();
const make = (o) => new Dish({ name: 'Hummus', description: 'd', price: 6, category: cat, ...o }).validateSync();
check('valid dish with Arabic name', !make({ nameAr: 'حمص' }));
check('nameAr saved on the document', new Dish({ name: 'x', nameAr: 'حمص' }).nameAr === 'حمص');
check('empty image allowed (placeholder)', !make({ image: '' }));
check('local path allowed', !make({ image: '/assets/images/dishes/hummus.jpg' }));
check('https URL allowed', !make({ image: 'https://example.com/a.jpg' }));
check('made-up path rejected', !!make({ image: 'hummus.jpg' })?.errors?.image);
check('price 0 rejected', !!make({ price: 0 })?.errors?.price);
check('missing name rejected', !!make({ name: '' })?.errors?.name);

server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

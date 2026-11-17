import 'dotenv/config';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { usingDefaultPassword } from './middleware/auth.js';

const PORT = process.env.PORT || 5000;

try {
  await connectDB();
} catch (err) {
  console.error('\n✖ Could not connect to MongoDB:', err.message);
  console.error('  Check that MongoDB is running and MONGODB_URI in server/.env is correct.\n');
  process.exit(1);
}

if (usingDefaultPassword()) console.warn('⚠ ADMIN_PASSWORD is not set in server/.env — using the demo password "sofra2026". Set your own before sharing the site.');

createApp().listen(PORT, () => console.log(`SOFRA API running on http://localhost:${PORT}/api`));

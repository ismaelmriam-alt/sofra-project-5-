import 'dotenv/config';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 5000;

try {
  await connectDB();
} catch (err) {
  console.error('\n✖ Could not connect to MongoDB:', err.message);
  console.error('  Check that MongoDB is running and MONGODB_URI in server/.env is correct.\n');
  process.exit(1);
}

createApp().listen(PORT, () => console.log(`SOFRA API running on http://localhost:${PORT}/api`));

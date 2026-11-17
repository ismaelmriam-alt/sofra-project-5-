// Vercel serverless entry: runs the SAME Express API (server/src) on Vercel, so the whole site
// (website + API) is one Vercel project. Needs MONGODB_URI and ADMIN_PASSWORD in Vercel → Settings → Environment Variables.
import { connectDB } from '../server/src/config/db.js';
import { createApp } from '../server/src/app.js';

const app = createApp();
let connecting; // reuse the database connection between requests

export default async function handler(req, res) {
  try {
    connecting ||= connectDB();
    await connecting;
  } catch (err) {
    connecting = undefined;
    console.error('MongoDB connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ message: 'The database is not reachable. Check MONGODB_URI in Vercel → Settings → Environment Variables, and Atlas Network Access (0.0.0.0/0).' }));
  }
  return app(req, res);
}

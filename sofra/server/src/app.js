import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { IMAGES_DIR } from './config/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', allowedHeaders: ['Content-Type', 'x-admin-key'] }));
  app.use(express.json({ limit: '200kb' }));

  // Photos (including admin uploads) are served from public/assets/images in production too
  app.use('/assets/images', express.static(IMAGES_DIR));

  app.use('/api', routes);
  app.use('/api', notFound);

  // Optional: serve the built React app from Express (npm run build in /client)
  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

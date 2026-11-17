import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { DISH_IMAGES_DIR, DISH_IMAGES_URL } from '../config/paths.js';
import { HttpError } from '../middleware/errorHandler.js';
import { isCloudinaryConfigured, getCloudinary } from '../config/cloudinary.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_BYTES = 5 * 1024 * 1024;
const PREFIX = 'upload-'; // only files created here are ever deleted automatically

const signatureOk = (b) =>
  (b[0] === 0xff && b[1] === 0xd8) ||
  (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||
  (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') ||
  b.slice(4, 12).toString().includes('ftypavif');

const storage = multer.diskStorage({
  destination: (req, file, cb) => { fs.mkdirSync(DISH_IMAGES_DIR, { recursive: true }); cb(null, DISH_IMAGES_DIR); },
  filename: (req, file, cb) => {
    const base = path.parse(file.originalname).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'dish';
    cb(null, `${PREFIX}${base}-${Date.now().toString(36)}.${EXT[file.mimetype]}`);
  },
});

const fileFilter = (req, file, cb) =>
  EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG, WebP or AVIF images are allowed'));
const limits = { fileSize: MAX_BYTES, files: 1 };
const toDisk = multer({ storage, limits, fileFilter }).single('image');
const toMemory = multer({ storage: multer.memoryStorage(), limits, fileFilter }).single('image');

// Cloudinary configured -> keep the file in memory and send it there; otherwise save to the local images folder.
export const uploadMiddleware = (req, res, next) => (isCloudinaryConfigured() ? toMemory : toDisk)(req, res, next);

export async function handleUpload(req, res) {
  if (!req.file) throw new HttpError(400, 'No image received. Choose a file first.');

  if (req.file.buffer) {
    // Cloudinary path
    if (!signatureOk(req.file.buffer)) throw new HttpError(400, 'That file is not a valid image');
    const cloudinary = await getCloudinary();
    if (!cloudinary) throw new HttpError(503, 'Image upload is not set up on this server. Paste a full https:// image link instead.');
    try {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'sofra/dishes', resource_type: 'image' }, (err, r) => (err ? reject(err) : resolve(r))).end(req.file.buffer);
      });
      return res.status(201).json({ path: result.secure_url, size: req.file.size });
    } catch (err) {
      console.error('Cloudinary upload failed:', err.message);
      throw new HttpError(502, 'The image service could not save this photo. Try again, or paste an https:// image link.');
    }
  }

  // Local disk path
  const buf = fs.readFileSync(req.file.path);
  if (!signatureOk(buf)) {
    fs.unlinkSync(req.file.path);
    throw new HttpError(400, 'That file is not a valid image');
  }
  res.status(201).json({ path: `${DISH_IMAGES_URL}/${req.file.filename}`, size: req.file.size });
}

// Delete an admin-uploaded file once no dish references it. Seed/manual photos are never touched.
export function removeUploadedImage(imagePath) {
  try {
    if (!imagePath || !imagePath.startsWith(`${DISH_IMAGES_URL}/${PREFIX}`)) return;
    const file = path.join(DISH_IMAGES_DIR, path.basename(imagePath));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch { /* best effort */ }
}

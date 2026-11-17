// Cloudinary is OPTIONAL. Nothing here runs at server startup and nothing throws when it is not configured.
// Set CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (or CLOUDINARY_URL) to turn it on.
export const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));

let cached;
// Loaded only when an upload actually happens. Returns null if not configured or the package is missing.
export async function getCloudinary() {
  if (!isCloudinaryConfigured()) return null;
  if (cached) return cached;
  try {
    const { v2 } = await import('cloudinary');
    if (!process.env.CLOUDINARY_URL) {
      v2.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    }
    cached = v2;
    return v2;
  } catch (err) {
    console.error('Cloudinary could not be loaded:', err.message);
    return null;
  }
}

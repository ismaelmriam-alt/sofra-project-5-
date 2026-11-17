import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Public image folders. Uploaded dish photos are saved here and served by Vite (dev) or Express (production).
export const IMAGES_DIR = path.resolve(here, '../../../client/public/assets/images');
export const DISH_IMAGES_DIR = path.join(IMAGES_DIR, 'dishes');
export const DISH_IMAGES_URL = '/assets/images/dishes';

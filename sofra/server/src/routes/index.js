import { Router } from 'express';
import mongoose from 'mongoose';
import { asyncHandler, validateObjectId } from '../middleware/errorHandler.js';
import * as cat from '../controllers/categoryController.js';
import * as dish from '../controllers/dishController.js';
import * as order from '../controllers/orderController.js';
import { requireAdmin, adminLogin } from '../middleware/auth.js';
import { getCurrentUser, loginUser, registerUser } from '../controllers/userAuthController.js';
import { requireUser } from '../middleware/userAuth.js';
import * as reservation from '../controllers/reservationController.js';
import { uploadMiddleware, handleUpload } from '../controllers/uploadController.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

const router = Router();
const id = validateObjectId('id');

router.get('/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Customer accounts use JWTs and remain separate from the shared admin key.
router.post('/auth/register', asyncHandler(registerUser));
router.post('/auth/login', asyncHandler(loginUser));
router.get('/auth/me', requireUser, asyncHandler(getCurrentUser));

// Customer reservation availability and booking are public; settings and management are admin-only.
router.get('/reservations/availability', asyncHandler(reservation.getReservationAvailability));
router.post('/reservations', asyncHandler(reservation.createReservation));
router.get('/reservation-settings', requireAdmin, asyncHandler(reservation.getReservationSettings));
router.put('/reservation-settings', requireAdmin, asyncHandler(reservation.saveReservationSettings));
router.get('/reservations', requireAdmin, asyncHandler(reservation.listReservations));
router.patch('/reservations/:id/status', requireAdmin, id, asyncHandler(reservation.updateReservationStatus));

// Admin session check (shared-secret, see middleware/auth.js)
router.post('/admin/login', adminLogin);
router.get('/admin/verify', requireAdmin, (req, res) => res.json({ ok: true }));
// Serverless hosting (Vercel) has a read-only disk: uploads work there only when optional Cloudinary settings exist; otherwise a friendly message is returned.
const uploadsOff = (req, res, next) => process.env.VERCEL && !isCloudinaryConfigured()
  ? res.status(501).json({ message: 'Photo upload is not set up on this hosting yet. Paste a full https:// image link instead (or ask the site owner to add Cloudinary settings).' })
  : next();
router.post('/uploads/dish-image', requireAdmin, uploadsOff, uploadMiddleware, asyncHandler(handleUpload));

// Categories — public read, admin write
router.get('/categories', asyncHandler(cat.listCategories));
router.post('/categories', requireAdmin, asyncHandler(cat.createCategory));
router.get('/categories/:id', id, asyncHandler(cat.getCategory));
router.put('/categories/:id', requireAdmin, id, asyncHandler(cat.updateCategory));
router.delete('/categories/:id', requireAdmin, id, asyncHandler(cat.deleteCategory));

// Dishes — public read, admin write
router.get('/dishes', asyncHandler(dish.listDishes));
router.post('/dishes', requireAdmin, asyncHandler(dish.createDish));
router.get('/dishes/:id', id, asyncHandler(dish.getDish));
router.put('/dishes/:id', requireAdmin, id, asyncHandler(dish.updateDish));
router.delete('/dishes/:id', requireAdmin, id, asyncHandler(dish.deleteDish));

// Orders — customers can place and look up an order; everything else is admin only
router.post('/orders', asyncHandler(order.createOrder));
router.get('/orders/lookup/:id', asyncHandler(order.getOrder));
router.get('/orders/stats', requireAdmin, asyncHandler(order.getStats));
router.get('/orders', requireAdmin, asyncHandler(order.listOrders));
router.patch('/orders/:id/status', requireAdmin, id, asyncHandler(order.updateOrderStatus));
router.delete('/orders/:id', requireAdmin, id, asyncHandler(order.deleteOrder));

export default router;

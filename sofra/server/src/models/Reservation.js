import mongoose from 'mongoose';

export const RESERVATION_STATUSES = ['Pending', 'Confirmed', 'Rejected', 'Cancelled'];

const reservationSchema = new mongoose.Schema(
  {
    reservationId: { type: String, required: true, unique: true, index: true },
    customerName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    specialRequest: { type: String, trim: true, maxlength: 500, default: '' },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    restaurantTimezone: { type: String, required: true },
    guestCount: { type: Number, required: true, min: 1, max: 1000 },
    durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    tableId: { type: String, required: true },
    tableName: { type: String, required: true },
    tableCapacity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: RESERVATION_STATUSES, default: 'Pending', index: true },
    occupiesTable: { type: Boolean, default: true },
    occupiedMinutes: { type: [Number], required: true, select: false },
  },
  { timestamps: true }
);

reservationSchema.index(
  { tableId: 1, occupiedMinutes: 1 },
  { unique: true, partialFilterExpression: { occupiesTable: true } }
);
reservationSchema.index({ date: 1, status: 1 });

export default mongoose.model('Reservation', reservationSchema);

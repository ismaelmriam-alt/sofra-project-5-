import mongoose from 'mongoose';

const daySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isOpen: { type: Boolean, required: true },
    openTime: { type: String, default: '' },
    closeTime: { type: String, default: '' },
  },
  { _id: false }
);

const tableSchema = new mongoose.Schema(
  {
    tableId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    capacity: { type: Number, required: true, min: 1, max: 1000 },
  },
  { _id: false }
);

const reservationSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'sofra-reservations' },
    configured: { type: Boolean, default: false },
    restaurantTimezone: { type: String, default: '' },
    weeklySchedule: { type: [daySchema], default: [] },
    reservationDurationMinutes: { type: Number, default: null },
    numberOfTables: { type: Number, default: 0 },
    tables: { type: [tableSchema], default: [] },
    maximumGuests: { type: Number, default: null },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('ReservationSettings', reservationSettingsSchema);

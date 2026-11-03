import { Model, Schema, Types, model, models } from 'mongoose';

export interface ManagerHandoverRecord {
  eventId: Types.ObjectId;
  managerId: Types.ObjectId;
  totalMinor: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ManagerHandoverRecord>({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  totalMinor: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

schema.index({ eventId: 1, managerId: 1 }, { unique: true });

export const ManagerHandover: Model<ManagerHandoverRecord> =
  (models.ManagerHandover as Model<ManagerHandoverRecord> | undefined) ??
  model<ManagerHandoverRecord>('ManagerHandover', schema);

import { Model, Schema, Types, model, models } from 'mongoose';

export interface IncomeRecord {
  eventId: Types.ObjectId;
  amountMinor: number;
  category: string;
  from: string;
  address: string;
  method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';
  note: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IncomeRecord>({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  amountMinor: { type: Number, required: true, min: 1 },
  category: { type: String, required: true },
  from: { type: String, required: true },
  address: { type: String, default: '' },
  method: { type: String, enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'], default: 'CASH' },
  note: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Income: Model<IncomeRecord> =
  (models.Income as Model<IncomeRecord> | undefined) ?? model<IncomeRecord>('Income', schema);

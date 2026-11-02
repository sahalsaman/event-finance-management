import { Schema, model, models } from 'mongoose';

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 70 },
    key: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const ExpenseCategory = models.ExpenseCategory || model('ExpenseCategory', schema);

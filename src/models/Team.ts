import { Model, Schema, Types, model, models } from 'mongoose';

export interface TeamRecord {
  name: string;
  key: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<TeamRecord>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  key: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Team: Model<TeamRecord> =
  (models.Team as Model<TeamRecord> | undefined) ?? model<TeamRecord>('Team', schema);

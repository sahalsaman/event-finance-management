import { Model, Schema, Types, model, models } from 'mongoose';

export interface EventRecord {
  name: string;
  eventDate: Date;
  location: string;
  budgetMinor: number;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  managerIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<EventRecord>({
  name:{type:String,required:true},
  eventDate:{type:Date,required:true},
  location:{type:String,default:''},
  budgetMinor:{type:Number,default:0,min:0},
  status:{type:String,enum:['UPCOMING','ACTIVE','COMPLETED'],default:'UPCOMING'},
  managerIds:[{type:Schema.Types.ObjectId,ref:'User'}],
  createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true}
},{timestamps:true});
schema.index({status:1},{unique:true,partialFilterExpression:{status:'ACTIVE'}});
export const Event: Model<EventRecord> =
  (models.Event as Model<EventRecord> | undefined) ?? model<EventRecord>('Event',schema);

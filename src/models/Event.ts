import { Model, Schema, Types, model, models } from 'mongoose';

export interface EventRecord {
  name: string;
  eventDate: Date;
  location: string;
  budgetMinor: number;
  targetMinor: number;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  managerIds: Types.ObjectId[];
  managerTargets: { managerId: Types.ObjectId; targetMinor: number }[];
  teamTargets: { teamId: Types.ObjectId; targetMinor: number }[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<EventRecord>({
  name:{type:String,required:true},
  eventDate:{type:Date,required:true},
  location:{type:String,default:''},
  budgetMinor:{type:Number,default:0,min:0},
  targetMinor:{type:Number,default:0,min:0},
  status:{type:String,enum:['UPCOMING','ACTIVE','COMPLETED'],default:'UPCOMING'},
  managerIds:[{type:Schema.Types.ObjectId,ref:'User'}],
  managerTargets:[{
    managerId:{type:Schema.Types.ObjectId,ref:'User',required:true},
    targetMinor:{type:Number,required:true,min:0},
  }],
  teamTargets:[{
    teamId:{type:Schema.Types.ObjectId,ref:'Team',required:true},
    targetMinor:{type:Number,required:true,min:0},
  }],
  createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true}
},{timestamps:true});
schema.index({status:1},{unique:true,partialFilterExpression:{status:'ACTIVE'}});
const cachedEventModel = models.Event as Model<EventRecord> | undefined;
if (
  cachedEventModel &&
  (
    !cachedEventModel.schema.path('targetMinor') ||
    !cachedEventModel.schema.path('managerTargets') ||
    !cachedEventModel.schema.path('teamTargets')
  )
) {
  delete models.Event;
}
export const Event: Model<EventRecord> =
  (models.Event as Model<EventRecord> | undefined) ?? model<EventRecord>('Event',schema);

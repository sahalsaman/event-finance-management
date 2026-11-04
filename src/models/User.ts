import { Model, Schema, Types, model, models } from 'mongoose';

export interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'MANAGER';
  sector?: string;
  teamIds?: Types.ObjectId[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<UserRecord>({
  name:{type:String,required:true},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  passwordHash:{type:String,required:true,select:false},
  role:{type:String,enum:['SUPER_ADMIN','MANAGER'],required:true},
  sector:{type:String,default:''},
  teamIds:[{type:Schema.Types.ObjectId,ref:'Team'}],
  active:{type:Boolean,default:true}
},{timestamps:true});

const cachedUserModel = models.User as Model<UserRecord> | undefined;
if (cachedUserModel && !cachedUserModel.schema.path('teamIds')) {
  delete models.User;
}

export const User: Model<UserRecord> =
  (models.User as Model<UserRecord> | undefined) ?? model<UserRecord>('User',schema);

import { Model, Schema, Types, model, models } from 'mongoose';

export interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'MANAGER';
  sector?: string;
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
  active:{type:Boolean,default:true}
},{timestamps:true});

export const User: Model<UserRecord> =
  (models.User as Model<UserRecord> | undefined) ?? model<UserRecord>('User',schema);

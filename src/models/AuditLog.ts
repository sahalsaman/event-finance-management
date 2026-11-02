import { Schema,model,models } from 'mongoose';
const schema=new Schema({actorId:{type:Schema.Types.ObjectId,ref:'User',required:true},action:{type:String,required:true},entityId:{type:Schema.Types.ObjectId,required:true},detail:{type:Schema.Types.Mixed,default:{}}},{timestamps:true});
export const AuditLog=models.AuditLog||model('AuditLog',schema);

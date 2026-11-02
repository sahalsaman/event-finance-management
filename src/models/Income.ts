import { Schema,model,models } from 'mongoose';
const schema=new Schema({eventId:{type:Schema.Types.ObjectId,ref:'Event',required:true,index:true},amountMinor:{type:Number,required:true,min:1},category:{type:String,required:true},from:{type:String,required:true},address:{type:String,default:''},method:{type:String,enum:['CASH','UPI','BANK_TRANSFER','OTHER'],default:'CASH'},note:{type:String,default:''},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true}},{timestamps:true});
export const Income=models.Income||model('Income',schema);

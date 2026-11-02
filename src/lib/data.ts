import {db} from '@/lib/db';
import {Event} from '@/models/Event';import {Income} from '@/models/Income';import {Expense} from '@/models/Expense';
import {currentUser,isAssigned} from '@/lib/access';
import {Types} from 'mongoose';
function creatorName(creator:unknown){return typeof creator==='object'&&creator!==null&&'name' in creator?String(creator.name):'';}
export async function activeData(){
 const user=await currentUser();await db();const e=await Event.findOne({status:'ACTIVE'}).lean();
 if(!e||!isAssigned(e,user))return {user,event:null,summary:null,incomes:[],expenses:[]};
 const event={id:String(e._id),name:String(e.name),date:new Date(e.eventDate).toISOString(),location:String(e.location||'')};
 const transactionFilter={eventId:e._id,...(user.role==='MANAGER'?{createdBy:new Types.ObjectId(user.id)}:{})};
 const [incomes,expenses]=await Promise.all([Income.find(transactionFilter).populate('createdBy','name').sort({createdAt:-1}).limit(30).lean(),Expense.find(transactionFilter).populate('createdBy','name').sort({createdAt:-1}).limit(30).lean()]);
 const [totalIncome,approved,pending]=await Promise.all([
  Income.aggregate([{$match:transactionFilter},{$group:{_id:null,v:{$sum:'$amountMinor'}}}]),
  Expense.aggregate([{$match:{...transactionFilter,status:'APPROVED'}},{$group:{_id:null,v:{$sum:'$amountMinor'}}}]),
  Expense.aggregate([{$match:{...transactionFilter,status:'PENDING'}},{$group:{_id:null,v:{$sum:'$amountMinor'}}}])]);
 const income=totalIncome[0]?.v||0,expense=approved[0]?.v||0,pendingExpense=pending[0]?.v||0;
 return {user,event,summary:{income,expense,totalExpense:expense+pendingExpense,pending:pendingExpense,balance:income-expense},
 incomes:incomes.map(i=>({id:String(i._id),category:String(i.category),amount:Number(i.amountMinor),from:String(i.from||''),createdByName:creatorName(i.createdBy),date:new Date(i.createdAt).toISOString()})),
 expenses:expenses.map(i=>({id:String(i._id),category:String(i.category),amount:Number(i.amountMinor),status:String(i.status),paidTo:String(i.paidTo||''),createdByName:creatorName(i.createdBy),date:new Date(i.createdAt).toISOString()}))};
}

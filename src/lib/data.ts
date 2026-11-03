import {db} from '@/lib/db';
import {Event} from '@/models/Event';import {Income} from '@/models/Income';import {Expense} from '@/models/Expense';
import {ManagerHandover} from '@/models/ManagerHandover';
import {currentUser,isAssigned} from '@/lib/access';
import {Types} from 'mongoose';
function creatorName(creator:unknown){return typeof creator==='object'&&creator!==null&&'name' in creator?String(creator.name):'';}
export async function activeData(){
 const user=await currentUser();await db();const e=await Event.findOne({status:'ACTIVE'}).lean();
 if(!e||!isAssigned(e,user))return {user,event:null,summary:null,incomes:[],expenses:[]};
 const event={
  id:String(e._id),
  name:String(e.name),
  date:new Date(e.eventDate).toISOString(),
  location:String(e.location||''),
  targetMinor:Number(e.targetMinor||0),
  managerTargetMinor:Number(e.managerTargets?.find(target=>String(target.managerId)===user.id)?.targetMinor||0),
 };
 const transactionFilter={eventId:e._id,...(user.role==='MANAGER'?{createdBy:new Types.ObjectId(user.id)}:{})};
 const [incomes,expenses]=await Promise.all([Income.find(transactionFilter).populate('createdBy','name').sort({createdAt:-1}).limit(30).lean(),Expense.find(transactionFilter).populate('createdBy','name').sort({createdAt:-1}).limit(30).lean()]);
 const managerIds=user.role==='MANAGER'
  ?[new Types.ObjectId(user.id)]
  :e.managerIds.map(managerId=>new Types.ObjectId(String(managerId)));
 const managerIncomeFilter={
  eventId:e._id,
  createdBy:user.role==='MANAGER'?managerIds[0]:{$in:managerIds},
 };
 const handoverFilter={
  eventId:e._id,
  managerId:user.role==='MANAGER'?managerIds[0]:{$in:managerIds},
 };
 const [totalIncome,approved,pending,managerCollected,paidToAdmin]=await Promise.all([
  Income.aggregate([{$match:transactionFilter},{$group:{_id:null,v:{$sum:'$amountMinor'}}}]),
  Expense.aggregate([{$match:{...transactionFilter,status:'APPROVED'}},{$group:{_id:null,v:{$sum:'$amountMinor'}}}]),
  Expense.aggregate([{$match:{...transactionFilter,status:'PENDING'}},{$group:{_id:null,v:{$sum:'$amountMinor'}}}]),
  managerIds.length
   ?Income.aggregate([{$match:managerIncomeFilter},{$group:{_id:null,v:{$sum:'$amountMinor'}}}])
   :Promise.resolve([]),
  managerIds.length
   ?ManagerHandover.aggregate([{$match:handoverFilter},{$group:{_id:null,v:{$sum:'$totalMinor'}}}])
   :Promise.resolve([])]);
 const income=totalIncome[0]?.v||0,expense=approved[0]?.v||0,pendingExpense=pending[0]?.v||0;
 const managerHandedOver=Number(paidToAdmin[0]?.v||0);
 const managerInHand=Math.max(Number(managerCollected[0]?.v||0)-managerHandedOver,0);
 return {user,event,summary:{income,expense,totalExpense:expense+pendingExpense,pending:pendingExpense,balance:income-expense-pendingExpense-managerHandedOver,paidToAdmin:managerHandedOver,nowInHand:managerInHand},
 incomes:incomes.map(i=>({id:String(i._id),category:String(i.category),amount:Number(i.amountMinor),from:String(i.from||''),address:String(i.address||''),method:String(i.method||'CASH'),note:String(i.note||''),createdById:String(typeof i.createdBy==='object'&&i.createdBy!==null&&'_id' in i.createdBy?i.createdBy._id:i.createdBy),createdByName:creatorName(i.createdBy),date:new Date(i.createdAt).toISOString()})),
 expenses:expenses.map(i=>({id:String(i._id),category:String(i.category),amount:Number(i.amountMinor),status:String(i.status),paidTo:String(i.paidTo||''),method:String(i.method||'CASH'),note:String(i.note||''),createdById:String(typeof i.createdBy==='object'&&i.createdBy!==null&&'_id' in i.createdBy?i.createdBy._id:i.createdBy),createdByName:creatorName(i.createdBy),date:new Date(i.createdAt).toISOString()}))};
}

import {db} from '@/lib/db';
import {Event} from '@/models/Event';import {Income} from '@/models/Income';import {Expense} from '@/models/Expense';
import {ManagerHandover} from '@/models/ManagerHandover';
import {Team} from '@/models/Team';import {User} from '@/models/User';
import {currentUser,isAssigned} from '@/lib/access';
import {Types} from 'mongoose';
function creatorName(creator:unknown){return typeof creator==='object'&&creator!==null&&'name' in creator?String(creator.name):'';}
export async function activeData(options:{transactionRange?:{start:Date;end:Date}}={}){
 const user=await currentUser();await db();const e=await Event.findOne({status:'ACTIVE'}).lean();
 if(!e||!isAssigned(e,user))return {user,event:null,summary:null,teamSummary:null,incomes:[],expenses:[]};
 const event={
  id:String(e._id),
  name:String(e.name),
  date:new Date(e.eventDate).toISOString(),
  location:String(e.location||''),
  targetMinor:Number(e.targetMinor||0),
  managerTargetMinor:Number(e.managerTargets?.find(target=>String(target.managerId)===user.id)?.targetMinor||0),
 };
 const transactionFilter={eventId:e._id,...(user.role==='MANAGER'?{createdBy:new Types.ObjectId(user.id)}:{})};
 let teamSummary:null|{name:string;income:number;target:number}=null;
 if(user.role==='MANAGER'){
  const assignedManagers=await User.find({_id:{$in:e.managerIds},role:'MANAGER'}).select('teamIds').lean();
  const assignedManagerById=new Map(assignedManagers.map(manager=>[String(manager._id),manager]));
  const currentManager=assignedManagerById.get(user.id);
  const currentAssignment=e.managerTeams?.find(assignment=>String(assignment.managerId)===user.id);
  const teamId=currentAssignment
   ?String(currentAssignment.teamId||'')
   :String(currentManager?.teamIds?.[0]||'');
  if(teamId){
   const team=await Team.findById(teamId).select('name').lean();
   if(team){
    const teamManagerIds=e.managerIds.filter(managerId=>{
     const managerIdString=String(managerId);
     const assignment=e.managerTeams?.find(item=>String(item.managerId)===managerIdString);
     if(assignment)return String(assignment.teamId||'')===teamId;
     return assignedManagerById.get(managerIdString)?.teamIds?.some(id=>String(id)===teamId)??false;
    });
    const teamIncome=teamManagerIds.length
     ?await Income.aggregate([
      {$match:{eventId:e._id,createdBy:{$in:teamManagerIds}}},
      {$group:{_id:null,total:{$sum:'$amountMinor'}}},
     ])
     :[];
    teamSummary={
     name:String(team.name),
     income:Number(teamIncome[0]?.total||0),
     target:Number(e.teamTargets?.find(target=>String(target.teamId)===teamId)?.targetMinor||0),
    };
   }
  }
 }
 const transactionDateFilter=options.transactionRange
  ?{createdAt:{$gte:options.transactionRange.start,$lt:options.transactionRange.end}}
  :{};
 const incomeQuery=Income.find({...transactionFilter,...transactionDateFilter}).populate('createdBy','name').sort({createdAt:-1});
 const expenseQuery=Expense.find({...transactionFilter,...transactionDateFilter}).populate('createdBy','name').sort({createdAt:-1});
 if(!options.transactionRange){incomeQuery.limit(30);expenseQuery.limit(30);}
 const [incomes,expenses]=await Promise.all([incomeQuery.lean(),expenseQuery.lean()]);
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
 return {user,event,summary:{income,expense,totalExpense:expense+pendingExpense,pending:pendingExpense,balance:income-expense-pendingExpense-managerHandedOver,paidToAdmin:managerHandedOver,nowInHand:managerInHand},teamSummary,
 incomes:incomes.map(i=>({id:String(i._id),category:String(i.category),amount:Number(i.amountMinor),sector:String(i.sector||''),unit:String(i.unit||''),from:String(i.from||''),fromMalayalam:String(i.from_ml||''),address:String(i.address||''),method:String(i.method||'CASH'),note:String(i.note||''),createdById:String(typeof i.createdBy==='object'&&i.createdBy!==null&&'_id' in i.createdBy?i.createdBy._id:i.createdBy),createdByName:creatorName(i.createdBy),date:new Date(i.createdAt).toISOString()})),
 expenses:expenses.map(i=>({id:String(i._id),category:String(i.category),amount:Number(i.amountMinor),status:String(i.status),paidTo:String(i.paidTo||''),method:String(i.method||'CASH'),note:String(i.note||''),createdById:String(typeof i.createdBy==='object'&&i.createdBy!==null&&'_id' in i.createdBy?i.createdBy._id:i.createdBy),createdByName:creatorName(i.createdBy),date:new Date(i.createdAt).toISOString()}))};
}

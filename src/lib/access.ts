import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { User } from '@/models/User';
export async function currentUser(){
 await connection();
 const session=await auth();if(!session?.user?.id)redirect('/login');
 await db();const user=await User.findById(session.user.id).lean();
 if(!user||!user.active)redirect('/login');
 return {id:String(user._id),name:String(user.name),email:String(user.email),role:user.role as 'SUPER_ADMIN'|'MANAGER'};
}
export async function admin(){const user=await currentUser();if(user.role!=='SUPER_ADMIN')throw new Error('Not authorized');return user;}
export function isAssigned(event:{managerIds:unknown[]},user:{id:string;role:string}){return user.role==='SUPER_ADMIN'||event.managerIds.some(id=>String(id)===user.id);}
export function rupees(minor:number){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(minor/100);}
export function parseMoney(value:FormDataEntryValue|null){const s=String(value??'');if(!/^\d{1,9}(\.\d{1,2})?$/.test(s))throw new Error('Enter a valid positive amount');const [a,b='']=s.split('.');const amount=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Invalid amount');return amount;}
export function formText(form:FormData,key:string,max=250){return String(form.get(key)||'').trim().slice(0,max);}

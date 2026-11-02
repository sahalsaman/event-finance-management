import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { allowLoginAttempt } from '@/lib/login-rate-limit';
import { User } from '@/models/User';
export const {handlers,auth,signIn,signOut}=NextAuth({
  session:{strategy:'jwt'},pages:{signIn:'/login'},
  providers:[Credentials({credentials:{email:{},password:{}},async authorize(raw,request){
    const parsed=z.object({email:z.email(),password:z.string().min(6)}).safeParse(raw);
    if(!parsed.success)return null;
    if(!await allowLoginAttempt(request,parsed.data.email))return null;
    await db();
    const user=await User.findOne({email:parsed.data.email.toLowerCase(),active:true}).select('+passwordHash');
    if(!user||!(await bcrypt.compare(parsed.data.password,user.passwordHash)))return null;
    return {id:String(user._id),name:user.name,email:user.email,role:user.role};
  }})],
  callbacks:{jwt({token,user}){if(user){token.uid=user.id;token.role=(user as {role:string}).role;}return token;},session({session,token}){session.user.id=String(token.uid||'');(session.user as typeof session.user & {role:string}).role=String(token.role||'');return session;}}
});

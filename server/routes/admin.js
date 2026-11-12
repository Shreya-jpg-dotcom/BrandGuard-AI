import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import User from '../models/User.js';
import Document from '../models/Document.js';
import BrandSource from '../models/BrandSource.js';
import EmployeeInvitation from '../models/EmployeeInvitation.js';
import ActivityLog from '../models/ActivityLog.js';
import Organization from '../models/Organization.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activityService.js';

const router=Router();
router.use(requireAuth,requireRole('admin'));
const org=(req)=>({organizationId:req.user.organizationId});
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
router.get('/employees',async(req,res,next)=>{
 try{
  const filter={...org(req),role:'employee'};
  if(req.query.q){const term=escapeRegex(String(req.query.q).slice(0,80));filter.$or=[{name:{$regex:term,$options:'i'}},{email:{$regex:term,$options:'i'}}];}
  if(req.query.status==='active')filter.active=true;
  if(req.query.status==='inactive')filter.active=false;
  const employees=await User.find(filter).select('name email active createdAt').sort({createdAt:-1}).limit(200);
  res.json({employees});
 }catch(e){next(e);}
});
router.get('/overview',async(req,res,next)=>{
 try{
  const [organization,employeeCount,documentCount,reviewQueueCount,activeSources,recentActivity]=await Promise.all([
   Organization.findById(req.user.organizationId).select('name slug'),
   User.countDocuments({...org(req),role:'employee',active:true}),
   Document.countDocuments(org(req)),
   Document.countDocuments({...org(req),status:'In Review'}),
   BrandSource.countDocuments({...org(req),status:'active'}),
   ActivityLog.find(org(req)).populate('actorId','name').sort({createdAt:-1}).limit(8)
  ]);
  res.json({organization,employeeCount,documentCount,reviewQueueCount,activeSources,recentActivity});
 }catch(e){next(e);}
});
router.patch('/employees/:id',async(req,res,next)=>{
 try{
  if(typeof req.body.active!=='boolean')return res.status(400).json({message:'Provide an active status.'});
  const employee=await User.findOneAndUpdate({_id:req.params.id,...org(req),role:'employee'},{$set:{active:req.body.active}},{new:true}).select('name email active createdAt');
  if(!employee)return res.status(404).json({message:'Employee not found.'});
  await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'employee.status.changed',entityType:'user',entityId:employee._id,summary:`${req.user.name} ${employee.active?'activated':'deactivated'} ${employee.name}`});
  res.json({employee});
 }catch(e){next(e);}
});
router.post('/invitations',async(req,res,next)=>{
 try{
  const email=String(req.body.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:'Enter a valid employee email address.'});
  if(await User.exists({email}))return res.status(409).json({message:'An account with this email already exists.'});
  await EmployeeInvitation.deleteMany({organizationId:req.user.organizationId,email,acceptedAt:null});
  const token=randomBytes(32).toString('hex');
  const invitation=await EmployeeInvitation.create({organizationId:req.user.organizationId,invitedBy:req.user._id,email,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+7*86400000)});
  await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'employee.invited',entityType:'invitation',entityId:invitation._id,summary:`${req.user.name} invited ${email}`});
  const origin=process.env.CLIENT_ORIGIN||'http://localhost:5173';
  res.status(201).json({invitation:{email,expiresAt:invitation.expiresAt,link:`${origin}/signup?invite=${token}`}});
 }catch(e){next(e);}
});
router.get('/activity',async(req,res,next)=>{
 try{const events=await ActivityLog.find(org(req)).populate('actorId','name email').sort({createdAt:-1}).limit(50);res.json({events});}catch(e){next(e);}
});
export default router;

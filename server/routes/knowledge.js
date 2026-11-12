import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import BrandSource from '../models/BrandSource.js';
import ApprovedFact from '../models/ApprovedFact.js';
import Terminology from '../models/Terminology.js';
import BrandAsset from '../models/BrandAsset.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateUpload, extractBuffer, storePrivateFile, removePrivateFile } from '../services/documentService.js';
import { logActivity } from '../services/activityService.js';

const router=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1}});
router.use(requireAuth,requireRole('admin'));
const org=(req)=>({organizationId:req.user.organizationId});
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
router.get('/',async(req,res,next)=>{
  try{
    const [guidelines,facts,terminology,assets]=await Promise.all([
      BrandSource.find(org(req)).select('-storagePath -extractedText').sort({createdAt:-1}),
      ApprovedFact.find(org(req)).sort({updatedAt:-1}).limit(200),
      Terminology.find(org(req)).sort({updatedAt:-1}).limit(200),
      BrandAsset.find(org(req)).select('-storagePath').sort({createdAt:-1})
    ]);
    res.json({guidelines,facts,terminology,assets});
  }catch(e){next(e);}
});
router.post('/guidelines',upload.single('file'),async(req,res,next)=>{
  let stored;
  try{
    if(!req.file) return res.status(400).json({message:'Choose a Brand Bible PDF.'});
    const ext=validateUpload(req.file);
    if(ext!=='.pdf') return res.status(415).json({message:'Brand Bible sources must be PDF files.'});
    const {text,metadata}=await extractBuffer(req.file.buffer,ext);
    stored=await storePrivateFile(req.file.buffer,ext,'brand-sources');
    const previous=await BrandSource.find(org(req)).sort({version:-1}).limit(1);
    const version=(previous[0]?.version||0)+1;
    await BrandSource.updateMany({...org(req),status:'active'},{$set:{status:'archived'}});
    const source=await BrandSource.create({organizationId:req.user.organizationId,uploadedBy:req.user._id,title:(req.body.title||path.parse(req.file.originalname).name).slice(0,180),originalName:req.file.originalname,storagePath:stored,extractedText:text,pageCount:metadata.pages,version,status:'active',processingStatus:'complete'});
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.source.uploaded',entityType:'brand_source',entityId:source._id,summary:`${req.user.name} uploaded Brand Bible version ${version}`});
    res.status(201).json({source:{...source.toObject(),storagePath:undefined,extractedText:undefined}});
  }catch(e){if(stored)await removePrivateFile(stored);next(e);}
});
router.get('/guidelines/:id/file',async(req,res,next)=>{
  try{
    const source=await BrandSource.findOne({_id:req.params.id,...org(req)}).select('+storagePath');
    if(!source)return res.status(404).json({message:'Brand Bible source not found.'});
    res.type('application/pdf').set('Content-Disposition',`inline; filename="${source.originalName.replace(/["\\\\]/g,'')}"`);
    res.sendFile(path.resolve(source.storagePath));
  }catch(e){next(e);}
});
router.patch('/guidelines/:id/archive',async(req,res,next)=>{
  try{
    const source=await BrandSource.findOneAndUpdate({_id:req.params.id,...org(req)},{status:'archived'},{new:true});
    if(!source)return res.status(404).json({message:'Source document not found.'});
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.source.archived',entityType:'brand_source',entityId:source._id,summary:`${req.user.name} archived ${source.title}`});
    res.json({source});
  }catch(e){next(e);}
});
router.get('/facts',async(req,res,next)=>{
  try{
    const filter={...org(req)};
    if(req.query.status&&req.query.status!=='all')filter.status=req.query.status;
    if(req.query.q){const term=escapeRegex(String(req.query.q).slice(0,80));filter.$or=[{claimKey:{$regex:term,$options:'i'}},{claim:{$regex:term,$options:'i'}},{value:{$regex:term,$options:'i'}}];}
    res.json({facts:await ApprovedFact.find(filter).sort({updatedAt:-1}).limit(250)});
  }catch(e){next(e);}
});
router.post('/facts',async(req,res,next)=>{
  try{
    const {claimKey,claim,value}=req.body;
    if(![claimKey,claim,value].every(x=>typeof x==='string'&&x.trim()))return res.status(400).json({message:'Claim key, approved claim and value are required.'});
    if(req.body.validFrom&&req.body.validUntil&&new Date(req.body.validUntil)<new Date(req.body.validFrom))return res.status(400).json({message:'Valid until must be after valid from.'});
    if(req.body.sourceDocumentId&&!await BrandSource.exists({_id:req.body.sourceDocumentId,...org(req)}))return res.status(400).json({message:'The selected source document is not part of this organisation.'});
    const fact=await ApprovedFact.create({organizationId:req.user.organizationId,claimKey,claim,value,description:req.body.description||'',sourceDocumentId:req.body.sourceDocumentId||null,sourceReference:req.body.sourceReference||'',validFrom:req.body.validFrom||null,validUntil:req.body.validUntil||null,status:req.body.status||'active',createdBy:req.user._id,updatedBy:req.user._id});
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.fact.created',entityType:'fact',entityId:fact._id,summary:`${req.user.name} added approved fact ${fact.claimKey}`});
    res.status(201).json({fact});
  }catch(e){next(e);}
});
router.patch('/facts/:id',async(req,res,next)=>{
  try{
    const updates={}; for(const key of ['claimKey','claim','value','description','sourceDocumentId','sourceReference','validFrom','validUntil','status'])if(key in req.body)updates[key]=req.body[key];
    if(req.body.sourceDocumentId&&!await BrandSource.exists({_id:req.body.sourceDocumentId,...org(req)}))return res.status(400).json({message:'The selected source document is not part of this organisation.'});
    if(req.body.validFrom&&req.body.validUntil&&new Date(req.body.validUntil)<new Date(req.body.validFrom))return res.status(400).json({message:'Valid until must be after valid from.'});
    updates.updatedBy=req.user._id;
    const fact=await ApprovedFact.findOneAndUpdate({_id:req.params.id,...org(req)},{$set:updates},{new:true,runValidators:true});
    if(!fact)return res.status(404).json({message:'Approved fact not found.'});
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.fact.updated',entityType:'fact',entityId:fact._id,summary:`${req.user.name} updated approved fact ${fact.claimKey}`});
    res.json({fact});
  }catch(e){next(e);}
});
router.delete('/facts/:id',async(req,res,next)=>{
  try{const fact=await ApprovedFact.findOneAndDelete({_id:req.params.id,...org(req)});if(!fact)return res.status(404).json({message:'Approved fact not found.'});await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.fact.deleted',entityType:'fact',entityId:fact._id,summary:`${req.user.name} deleted approved fact ${fact.claimKey}`});res.json({message:'Approved fact deleted.'});}catch(e){next(e);}
});
router.get('/terminology',async(req,res,next)=>{
  try{const filter={...org(req)};if(req.query.status&&req.query.status!=='all')filter.status=req.query.status;if(req.query.q){const term=escapeRegex(String(req.query.q).slice(0,80));filter.$or=[{preferredTerm:{$regex:term,$options:'i'}},{bannedTerm:{$regex:term,$options:'i'}},{category:{$regex:term,$options:'i'}}];}res.json({terminology:await Terminology.find(filter).sort({updatedAt:-1}).limit(250)});}catch(e){next(e);}
});
router.post('/terminology',async(req,res,next)=>{
  try{
    if(!req.body.preferredTerm&&!req.body.bannedTerm)return res.status(400).json({message:'Add a preferred term or a banned term.'});
    const item=await Terminology.create({organizationId:req.user.organizationId,preferredTerm:req.body.preferredTerm||'',bannedTerm:req.body.bannedTerm||'',aliases:Array.isArray(req.body.aliases)?req.body.aliases.slice(0,30):[],category:req.body.category||'General',explanation:req.body.explanation||'',usageNotes:req.body.usageNotes||'',sourceReference:req.body.sourceReference||'',status:req.body.status||'active',createdBy:req.user._id});
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.term.created',entityType:'terminology',entityId:item._id,summary:`${req.user.name} added a terminology rule`});
    res.status(201).json({item});
  }catch(e){next(e);}
});
router.patch('/terminology/:id',async(req,res,next)=>{
  try{const fields=['preferredTerm','bannedTerm','aliases','category','explanation','usageNotes','sourceReference','status'];const updates={};for(const key of fields)if(key in req.body)updates[key]=req.body[key];const item=await Terminology.findOneAndUpdate({_id:req.params.id,...org(req)},{$set:updates},{new:true,runValidators:true});if(!item)return res.status(404).json({message:'Terminology record not found.'});await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.term.updated',entityType:'terminology',entityId:item._id,summary:`${req.user.name} updated a terminology rule`});res.json({item});}catch(e){next(e);}
});
router.delete('/terminology/:id',async(req,res,next)=>{
  try{const item=await Terminology.findOneAndDelete({_id:req.params.id,...org(req)});if(!item)return res.status(404).json({message:'Terminology record not found.'});await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.term.deleted',entityType:'terminology',entityId:item._id,summary:`${req.user.name} deleted a terminology rule`});res.json({message:'Terminology deleted.'});}catch(e){next(e);}
});
router.post('/assets',upload.single('file'),async(req,res,next)=>{
  let stored;
  try{
    if(!req.file)return res.status(400).json({message:'Choose an asset file.'});
    const ext=validateUpload(req.file,{asset:true});
    if(ext==='.svg'&&/<script|on\w+\s*=|javascript:|foreignObject|(?:href|src)\s*=\s*[\"\']https?:/i.test(req.file.buffer.toString('utf8')))return res.status(400).json({message:'This SVG contains active content and cannot be uploaded.'});
    stored=await storePrivateFile(req.file.buffer,ext,'brand-assets');
    const asset=await BrandAsset.create({organizationId:req.user.organizationId,uploadedBy:req.user._id,name:(req.body.name||path.parse(req.file.originalname).name).slice(0,160),type:req.body.type||'other',description:req.body.description||'',usageGuidelines:req.body.usageGuidelines||'',storagePath:stored,originalName:req.file.originalname,mimeType:req.file.mimetype,size:req.file.size});
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.asset.uploaded',entityType:'asset',entityId:asset._id,summary:`${req.user.name} uploaded brand asset ${asset.name}`});
    res.status(201).json({asset:{...asset.toObject(),storagePath:undefined}});
  }catch(e){if(stored)await removePrivateFile(stored);next(e);}
});
router.get('/assets/:id/file',async(req,res,next)=>{
  try{
    const asset=await BrandAsset.findOne({_id:req.params.id,...org(req)}).select('+storagePath');
    if(!asset)return res.status(404).json({message:'Asset not found.'});
    res.type(asset.mimeType).set('Cache-Control','private, no-store').sendFile(path.resolve(asset.storagePath));
  }catch(e){next(e);}
});
router.delete('/assets/:id',async(req,res,next)=>{
  try{const asset=await BrandAsset.findOne({_id:req.params.id,...org(req)}).select('+storagePath');if(!asset)return res.status(404).json({message:'Asset not found.'});await BrandAsset.deleteOne({_id:asset._id});await removePrivateFile(asset.storagePath);await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'brand.asset.deleted',entityType:'asset',entityId:asset._id,summary:`${req.user.name} deleted brand asset ${asset.name}`});res.json({message:'Asset deleted.'});}catch(e){next(e);}
});
export default router;

import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import DocumentVersion from '../models/DocumentVersion.js';
import {accessibleDocument,snapshot,audit} from '../services/governanceService.js';
const router=Router();router.use(requireAuth);
router.get('/documents/:id/versions',async(req,res,next)=>{try{
 const doc=await accessibleDocument(req,req.params.id,'_id');if(!doc)return res.status(404).json({message:'Document not found.'});
 const versions=await DocumentVersion.find({organizationId:req.user.organizationId,documentId:doc._id}).select('-extractedText -structure').populate('createdBy','name').sort({versionNo:-1});
 res.json({versions});
}catch(e){next(e)}});
router.get('/documents/:id/versions/:versionId',async(req,res,next)=>{try{
 const doc=await accessibleDocument(req,req.params.id,'_id');if(!doc)return res.status(404).json({message:'Document not found.'});
 const version=await DocumentVersion.findOne({_id:req.params.versionId,documentId:doc._id,organizationId:req.user.organizationId}).populate('createdBy','name');
 if(!version)return res.status(404).json({message:'Version not found.'});res.json({version});
}catch(e){next(e)}});
router.post('/documents/:id/versions/:versionId/restore',async(req,res,next)=>{try{
 const doc=await accessibleDocument(req,req.params.id);if(!doc)return res.status(404).json({message:'Document not found.'});
 const old=await DocumentVersion.findOne({_id:req.params.versionId,documentId:doc._id,organizationId:req.user.organizationId});
 if(!old)return res.status(404).json({message:'Version not found.'});
 doc.title=old.title;doc.description=old.description;doc.category=old.category;doc.extractedText=old.extractedText;doc.structure=old.structure||{};
 doc.version+=1;doc.status='Revised';doc.analysisStatus='not_run';doc.latestAnalysisAt=null;await doc.save();
 const version=await snapshot(doc,req.user._id,`Restored content from version ${old.versionNo}`);
 await audit(req,'document.version_restored','document',doc._id,doc._id,{restoredFrom:old.versionNo,newVersion:doc.version});
 res.json({document:{_id:doc._id,title:doc.title,version:doc.version,content:doc.extractedText},version});
}catch(e){next(e)}});
router.get('/documents/:id/audit',async(req,res,next)=>{try{
 const doc=await accessibleDocument(req,req.params.id,'_id');if(!doc)return res.status(404).json({message:'Document not found.'});
 const AuditEvent=(await import('../models/AuditEvent.js')).default;
 const events=await AuditEvent.find({organizationId:req.user.organizationId,documentId:doc._id}).populate('actorId','name email').sort({createdAt:-1}).limit(200);
 res.json({events});
}catch(e){next(e)}});
export default router;

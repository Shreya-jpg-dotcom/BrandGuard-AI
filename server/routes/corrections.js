import {Router} from 'express';
import CorrectionSuggestion from '../models/CorrectionSuggestion.js';
import Analysis from '../models/Analysis.js';
import {requireAuth} from '../middleware/auth.js';
import {accessibleDocument,snapshot,audit} from '../services/governanceService.js';
import {applyExactTextPatch} from '../services/textPatchService.js';
const router=Router();router.use(requireAuth);
router.post('/analyses/:analysisId/suggestions',async(req,res,next)=>{try{
 const analysis=await Analysis.findOne({_id:req.params.analysisId,organizationId:req.user.organizationId});
 if(!analysis)return res.status(404).json({message:'Analysis not found.'});
 const doc=await accessibleDocument(req,analysis.documentId);if(!doc)return res.status(404).json({message:'Document not found.'});
 if(analysis.documentVersion!==doc.version)return res.status(409).json({message:'This analysis belongs to an older document version. Re-analyse before creating a correction.'});
 const start=Number(req.body.start),end=Number(req.body.end),proposedText=String(req.body.proposedText||'');
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>doc.extractedText.length||!proposedText.trim()||proposedText.length>12000)return res.status(400).json({message:'Invalid correction span or replacement text.'});
 const originalText=doc.extractedText.slice(start,end);
 if(req.body.originalText!==undefined&&req.body.originalText!==originalText)return res.status(409).json({message:'The selected text no longer matches this analysis. Re-run analysis before creating a correction.'});
 const suggestion=await CorrectionSuggestion.create({organizationId:req.user.organizationId,documentId:doc._id,analysisId:analysis._id,findingId:String(req.body.findingId||''),createdBy:req.user._id,versionNo:doc.version,start,end,originalText,proposedText,explanation:String(req.body.explanation||'').slice(0,2000)});
 await audit(req,'correction.suggested','suggestion',suggestion._id,doc._id,{versionNo:doc.version});
 res.status(201).json({suggestion});
}catch(e){next(e)}});
router.patch('/suggestions/:id',async(req,res,next)=>{try{
 const s=await CorrectionSuggestion.findOne({_id:req.params.id,organizationId:req.user.organizationId,createdBy:req.user._id,status:'pending'});
 if(!s)return res.status(404).json({message:'Pending suggestion not found.'});
 const nextText=String(req.body.proposedText||'').trim();if(!nextText||nextText.length>12000)return res.status(400).json({message:'Enter valid replacement text.'});
 s.proposedText=nextText;await s.save();const doc=await accessibleDocument(req,s.documentId,'_id');if(doc)await audit(req,'correction.edited','suggestion',s._id,doc._id,{versionNo:s.versionNo});res.json({suggestion:s});
}catch(e){next(e)}});
router.post('/suggestions/:id/reject',async(req,res,next)=>{try{
 const s=await CorrectionSuggestion.findOneAndUpdate({_id:req.params.id,organizationId:req.user.organizationId,createdBy:req.user._id,status:'pending'},{$set:{status:'rejected'}},{new:true});
 if(!s)return res.status(404).json({message:'Pending suggestion not found.'});
 await audit(req,'correction.rejected','suggestion',s._id,s.documentId);res.json({suggestion:s});
}catch(e){next(e)}});
router.post('/suggestions/:id/apply',async(req,res,next)=>{try{
 const s=await CorrectionSuggestion.findOne({_id:req.params.id,organizationId:req.user.organizationId,createdBy:req.user._id,status:'pending'});
 if(!s)return res.status(404).json({message:'Pending suggestion not found.'});
 const doc=await accessibleDocument(req,s.documentId);if(!doc)return res.status(404).json({message:'Document not found.'});
 if(doc.version!==s.versionNo||doc.extractedText.slice(s.start,s.end)!==s.originalText){
  s.status='stale';await s.save();return res.status(409).json({message:'This suggestion is stale because the document changed. Re-analyse and create a new suggestion.',suggestion:s});
 }
 const next=applyExactTextPatch(doc.extractedText,s.start,s.end,s.originalText,s.proposedText);
 if(next.length>500000)return res.status(413).json({message:'The revised document exceeds the supported content limit.'});
 doc.extractedText=next;doc.version+=1;doc.status='Revised';doc.analysisStatus='not_run';doc.latestAnalysisAt=null;await doc.save();
 await snapshot(doc,req.user._id,'Applied an approved correction suggestion');
 s.status='applied';await s.save();
 await audit(req,'correction.applied','suggestion',s._id,doc._id,{newVersion:doc.version,analysisMustBeRerun:true});
 res.json({suggestion:s,document:{_id:doc._id,version:doc.version,content:doc.extractedText,status:doc.status},analysisInvalidated:true});
}catch(e){next(e)}});
export default router;

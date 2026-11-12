import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import Document from '../models/Document.js';
import DocumentVersion from '../models/DocumentVersion.js';
import Analysis from '../models/Analysis.js';
import { requireAuth } from '../middleware/auth.js';
import { analyze } from '../engine/index.js';
import { logActivity } from '../services/activityService.js';
import { audit } from '../services/governanceService.js';

const router = Router();
router.use(requireAuth);
const analysisLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Analysis limit reached. Please try again later.' } });
const scope = req => req.user.role === 'admin'
  ? { organizationId: req.user.organizationId }
  : { organizationId: req.user.organizationId, ownerId: req.user._id };

router.post('/documents/:id/analyze', analysisLimiter, async (req,res,next) => {
  let doc;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid document identifier.' });
    doc = await Document.findOne({ _id:req.params.id, ...scope(req) }).select('+extractedText');
    if (!doc) return res.status(404).json({ message:'Document not found or you do not have access.' });
    if (doc.extractionStatus !== 'complete' || !doc.extractedText?.trim()) return res.status(422).json({ message:'This document has no successfully extracted text. Re-upload or extract it before analysis.' });
    const lock = await Document.findOneAndUpdate(
      { _id:doc._id, organizationId:req.user.organizationId, analysisStatus: { $ne:'pending' } },
      { $set:{ analysisStatus:'pending' } }, { new:true }
    );
    if (!lock) return res.status(409).json({ message:'An analysis is already running for this document.' });
    try {
      const version = await DocumentVersion.findOne({ documentId:doc._id, organizationId:req.user.organizationId, versionNo:doc.version }).select('_id');
      const result = await analyze({
        documentId:doc._id, organizationId:req.user.organizationId, content:doc.extractedText,
        format:doc.format, structure:doc.structure || {}, brandId:req.user.organizationId
      });
      const report = await Analysis.create({
        organizationId:req.user.organizationId, documentId:doc._id, documentVersionId:version?._id || null,
        documentVersion:doc.version, requestedBy:req.user._id, status:result.status, method:result.method,
        provider:result.provider, model:result.model, scoringVersion:result.scoringVersion,
        overallScore:result.overallScore, complianceStatus:result.complianceStatus,
        dimensions:result.dimensions, coverage:result.coverage, findings:result.findings,
        summary:result.summary, warnings:result.warnings
      });
      doc.analysisStatus='complete'; doc.latestAnalysisAt=new Date(); await doc.save();
      await audit(req,'document.analysis_run','analysis',report._id,doc._id,{versionNo:doc.version,method:result.method,provider:result.provider,scoringVersion:result.scoringVersion});
      await logActivity({ organizationId:req.user.organizationId, actorId:req.user._id, action:'document.analyzed', entityType:'analysis', entityId:report._id, summary:`${req.user.name} analysed ${doc.title}` });
      return res.status(201).json({ analysis:report, metrics:result.metrics, issueCounts:result.issueCounts, retrieval:result.retrieval });
    } catch (error) {
      doc.analysisStatus='failed'; await doc.save().catch(()=>{});
      throw error;
    }
  } catch(error) { next(error); }
});

router.get('/documents/:id/analyses', async(req,res,next)=>{
  try {
    const doc=await Document.findOne({ _id:req.params.id, ...scope(req) }).select('_id');
    if(!doc)return res.status(404).json({message:'Document not found or you do not have access.'});
    const analyses=await Analysis.find({documentId:doc._id,organizationId:req.user.organizationId}).select('-findings').sort({createdAt:-1}).limit(50).populate('requestedBy','name');
    res.json({analyses});
  }catch(error){next(error);}
});

router.get('/:analysisId', async(req,res,next)=>{
  try {
    if(!mongoose.isValidObjectId(req.params.analysisId))return res.status(400).json({message:'Invalid analysis identifier.'});
    const filter={_id:req.params.analysisId,organizationId:req.user.organizationId};
    if(req.user.role!=='admin') {
      const ownDocs=await Document.find({ownerId:req.user._id,organizationId:req.user.organizationId}).distinct('_id');
      filter.documentId={$in:ownDocs};
    }
    const analysis=await Analysis.findOne(filter);
    if(!analysis)return res.status(404).json({message:'Analysis report not found or you do not have access.'});
    res.json({analysis});
  }catch(error){next(error);}
});

router.get('/:analysisId/findings', async(req,res,next)=>{
  try {
    const filter={_id:req.params.analysisId,organizationId:req.user.organizationId};
    if(req.user.role!=='admin') {
      const ownDocs=await Document.find({ownerId:req.user._id,organizationId:req.user.organizationId}).distinct('_id');
      filter.documentId={$in:ownDocs};
    }
    const analysis=await Analysis.findOne(filter).select('findings');
    if(!analysis)return res.status(404).json({message:'Analysis report not found or you do not have access.'});
    res.json({findings:analysis.findings});
  }catch(error){next(error);}
});

router.get('/:analysisId/score', async(req,res,next)=>{
  try {
    const filter={_id:req.params.analysisId,organizationId:req.user.organizationId};
    if(req.user.role!=='admin') {
      const ownDocs=await Document.find({ownerId:req.user._id,organizationId:req.user.organizationId}).distinct('_id');
      filter.documentId={$in:ownDocs};
    }
    const analysis=await Analysis.findOne(filter).select('overallScore complianceStatus dimensions coverage scoringVersion');
    if(!analysis)return res.status(404).json({message:'Analysis report not found or you do not have access.'});
    res.json({score:analysis});
  }catch(error){next(error);}
});

router.patch('/:analysisId/findings/:findingId', async(req,res,next)=>{
  try {
    const {status,reason=''}=req.body||{};
    if(!['accepted','dismissed','open'].includes(status))return res.status(400).json({message:'Choose accepted, dismissed or open.'});
    const filter={_id:req.params.analysisId,organizationId:req.user.organizationId};
    if(req.user.role!=='admin') {
      const ownDocs=await Document.find({ownerId:req.user._id,organizationId:req.user.organizationId}).distinct('_id');
      filter.documentId={$in:ownDocs};
    }
    const analysis=await Analysis.findOne(filter);
    if(!analysis)return res.status(404).json({message:'Analysis report not found or you do not have access.'});
    const item=analysis.findings.find(f=>f.issueId===req.params.findingId);
    if(!item)return res.status(404).json({message:'Finding not found.'});
    if(status==='dismissed' && ['critical','major'].includes(item.severity) && String(reason).trim().length<8)return res.status(400).json({message:'Add a reason of at least 8 characters to dismiss a high-severity finding.'});
    item.status=status;
    if(reason)item.resolutionReason=String(reason).slice(0,1000);
    await analysis.save();
    res.json({finding:item});
  }catch(error){next(error);}
});

router.get('/:analysisId/history', async(req,res,next)=>{
  try {
    const filter={_id:req.params.analysisId,organizationId:req.user.organizationId};
    if(req.user.role!=='admin') {
      const ownDocs=await Document.find({ownerId:req.user._id,organizationId:req.user.organizationId}).distinct('_id');
      filter.documentId={$in:ownDocs};
    }
    const current=await Analysis.findOne(filter).select('documentId');
    if(!current)return res.status(404).json({message:'Analysis report not found or you do not have access.'});
    const history=await Analysis.find({documentId:current.documentId,organizationId:req.user.organizationId}).select('-findings').sort({createdAt:-1}).limit(50);
    res.json({history});
  }catch(error){next(error);}
});
export default router;

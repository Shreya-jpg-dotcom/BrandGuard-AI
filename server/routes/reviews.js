import {Router} from 'express';
import mongoose from 'mongoose';
import {requireAuth,requireRole} from '../middleware/auth.js';
import Review from '../models/Review.js';
import Document from '../models/Document.js';
import Analysis from '../models/Analysis.js';
import {accessibleDocument,snapshot,audit} from '../services/governanceService.js';
const router=Router();router.use(requireAuth);
router.post('/documents/:id/submit',async(req,res,next)=>{try{
 const doc=await accessibleDocument(req,req.params.id);if(!doc)return res.status(404).json({message:'Document not found.'});
 const analysis=await Analysis.findOne({organizationId:req.user.organizationId,documentId:doc._id,documentVersion:doc.version}).sort({createdAt:-1});
 if(!analysis)return res.status(409).json({message:'Run an analysis on the current document version before submitting.'});
 const staleReviews=await Review.find({organizationId:req.user.organizationId,documentId:doc._id,status:'in_review',versionNo:{$ne:doc.version}});
 for(const stale of staleReviews){stale.status='superseded';await stale.save();await audit(req,'review.superseded','review',stale._id,doc._id,{submittedVersion:doc.version,previousVersion:stale.versionNo});}
 const active=await Review.findOne({organizationId:req.user.organizationId,documentId:doc._id,status:'in_review',versionNo:doc.version});
 if(active)return res.status(409).json({message:'This document version is already in the review queue.'});
 doc.status='In Review';await doc.save();
 // The current immutable DocumentVersion is the submission snapshot; create one only for legacy records missing it.
 const currentSnapshot=await (await import('../models/DocumentVersion.js')).default.findOne({organizationId:req.user.organizationId,documentId:doc._id,versionNo:doc.version});
 if(!currentSnapshot)await snapshot(doc,req.user._id,'Submission snapshot');
 const review=await Review.create({organizationId:req.user.organizationId,documentId:doc._id,creatorId:req.user._id,versionNo:doc.version,analysisId:analysis._id});
 await audit(req,'review.submitted','review',review._id,doc._id,{versionNo:doc.version});
 res.status(201).json({review});
}catch(e){next(e)}});
router.get('/reviews/queue',requireRole('admin'),async(req,res,next)=>{try{
 const filter={organizationId:req.user.organizationId};if(req.query.status&&req.query.status!=='all')filter.status=req.query.status;
 const reviews=await Review.find(filter).populate('documentId','title format version status').populate('creatorId','name email').populate('reviewerId','name').populate('comments.authorId','name').sort({submittedAt:1}).limit(100);
 res.json({reviews});
}catch(e){next(e)}});
router.get('/documents/:id/reviews',async(req,res,next)=>{try{
 const doc=await accessibleDocument(req,req.params.id,'_id');if(!doc)return res.status(404).json({message:'Document not found.'});
 const filter={organizationId:req.user.organizationId,documentId:doc._id};if(req.user.role!=='admin')filter.creatorId=req.user._id;
 const reviews=await Review.find(filter).populate('creatorId','name').populate('reviewerId','name').populate('comments.authorId','name').sort({createdAt:-1});
 res.json({reviews});
}catch(e){next(e)}});
router.post('/reviews/:id/comments',async(req,res,next)=>{try{
 const text=String(req.body.text||'').trim();if(!text||text.length>3000)return res.status(400).json({message:'Enter a comment up to 3,000 characters.'});
 const review=await Review.findOne({_id:req.params.id,organizationId:req.user.organizationId});
 if(!review)return res.status(404).json({message:'Review not found.'});
 if(req.user.role!=='admin'&&String(review.creatorId)!==String(req.user._id))return res.status(403).json({message:'You cannot comment on this review.'});
 review.comments.push({authorId:req.user._id,versionNo:review.versionNo,findingId:String(req.body.findingId||''),start:Number.isInteger(req.body.start)?req.body.start:null,end:Number.isInteger(req.body.end)?req.body.end:null,text});
 await review.save();await audit(req,'review.comment_added','review',review._id,review.documentId);
 res.status(201).json({comment:review.comments[review.comments.length-1]});
}catch(e){next(e)}});
router.post('/reviews/:id/decision',requireRole('admin'),async(req,res,next)=>{try{
 const decision=String(req.body.decision||''),reason=String(req.body.reason||'').trim();
 if(!['approved','changes_requested','override'].includes(decision))return res.status(400).json({message:'Choose approved, changes_requested or override.'});
 if((decision==='changes_requested'||decision==='override')&&reason.length<8)return res.status(400).json({message:'Provide a reason of at least 8 characters.'});
 const review=await Review.findOne({_id:req.params.id,organizationId:req.user.organizationId,status:'in_review'});
 if(!review)return res.status(404).json({message:'Active review not found.'});
 const doc=await Document.findOne({_id:review.documentId,organizationId:req.user.organizationId});
 if(!doc)return res.status(404).json({message:'Document not found.'});
 if(doc.version!==review.versionNo || doc.status!=='In Review')return res.status(409).json({message:'The document changed after submission. This review is stale; submit the current version for a new review.'});
 if(decision==='approved'||decision==='override'){
  const analysis=await Analysis.findOne({_id:review.analysisId,organizationId:req.user.organizationId,documentId:doc._id,documentVersion:review.versionNo});
  if(!analysis)return res.status(409).json({message:'The submitted version no longer has a matching analysis. Submit a freshly analysed version.'});
  const openCritical=(analysis.findings||[]).filter(f=>f.severity==='critical'&&['open','needs_human_judgement'].includes(f.status));
  if(openCritical.length&&decision!=='override')return res.status(409).json({message:'Open critical findings block approval. Use an authorised override with a recorded reason if policy permits.'});
  if(decision==='override'&&!openCritical.length)return res.status(409).json({message:'There are no unresolved critical findings to override.'});
  if(openCritical.length&&decision==='override')await audit(req,'review.critical_override','review',review._id,doc._id,{reason,criticalCount:openCritical.length});
  review.status='approved';doc.status='Approved';
 }else{review.status='changes_requested';doc.status='Changes Requested';}
 review.reviewerId=req.user._id;review.decisions.push({actorId:req.user._id,decision,reason,versionNo:review.versionNo});
 await review.save();await doc.save();
 await audit(req,`review.${decision}`,'review',review._id,doc._id,{reason,versionNo:review.versionNo});
 res.json({review,documentStatus:doc.status});
}catch(e){next(e)}});
router.post('/documents/:id/publish',requireRole('admin'),async(req,res,next)=>{try{
 const doc=await Document.findOne({_id:req.params.id,organizationId:req.user.organizationId});
 if(!doc)return res.status(404).json({message:'Document not found.'});
 if(doc.status!=='Approved')return res.status(409).json({message:'Only an approved document can be manually marked as published.'});
 doc.status='Published';await doc.save();await audit(req,'document.published_manual','document',doc._id,doc._id,{manual:true});
 res.json({document:{_id:doc._id,status:doc.status},message:'Document manually marked as published.'});
}catch(e){next(e)}});
export default router;

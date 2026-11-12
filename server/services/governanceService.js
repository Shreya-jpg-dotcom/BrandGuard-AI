import Document from '../models/Document.js';
import DocumentVersion from '../models/DocumentVersion.js';
import Analysis from '../models/Analysis.js';
import AuditEvent from '../models/AuditEvent.js';
export const documentScope=req=>req.user.role==='admin'
 ? {organizationId:req.user.organizationId}
 : {organizationId:req.user.organizationId,ownerId:req.user._id};
export async function accessibleDocument(req,id,select='+extractedText'){
 const q=Document.findOne({_id:id,...documentScope(req)});
 return select?q.select(select):q;
}
export async function audit(req,action,entityType,entityId,documentId,metadata={}){
 return AuditEvent.create({organizationId:req.user.organizationId,actorId:req.user._id,action,entityType,entityId:String(entityId),documentId,metadata});
}
export async function snapshot(doc,userId,changeDescription='Edited document'){
 const version=await DocumentVersion.create({
  organizationId:doc.organizationId,documentId:doc._id,versionNo:doc.version,
  title:doc.title,description:doc.description,category:doc.category,format:doc.format,
  extractedText:doc.extractedText,structure:doc.structure||{},createdBy:userId,
  changeDescription
 });
 return version;
}
export async function latestAnalysis(doc){
 return Analysis.findOne({organizationId:doc.organizationId,documentId:doc._id,documentVersion:doc.version}).sort({createdAt:-1});
}

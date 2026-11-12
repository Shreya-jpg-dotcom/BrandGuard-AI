import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import Document from '../models/Document.js';
import DocumentVersion from '../models/DocumentVersion.js';
import { requireAuth } from '../middleware/auth.js';
import { validateUpload, extractBuffer, storePrivateFile, removePrivateFile, publicDocument } from '../services/documentService.js';
import { logActivity } from '../services/activityService.js';
import { audit } from '../services/governanceService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
router.use(requireAuth);

function scope(req) {
  return req.user.role === 'admin' ? { organizationId: req.user.organizationId } : { organizationId: req.user.organizationId, ownerId: req.user._id };
}
router.post('/upload', upload.single('file'), async (req, res, next) => {
  let savedPath;
  try {
    const ext = validateUpload(req.file);
    const { text, metadata, structure } = await extractBuffer(req.file.buffer, ext);
    savedPath = await storePrivateFile(req.file.buffer, ext);
    const title = (req.body.title || path.parse(req.file.originalname).name).trim().slice(0,180);
    if (!title) throw Object.assign(new Error('Enter a document title.'), { status: 400 });
    const doc = await Document.create({
      organizationId: req.user.organizationId, ownerId: req.user._id, title,
      description: (req.body.description || '').slice(0,1200), category: (req.body.category || 'General').slice(0,80),
      format: ext.slice(1), originalName: req.file.originalname, storagePath: savedPath, mimeType: req.file.mimetype,
      size: req.file.size, extractedText: text, extractionStatus: 'complete', status: 'Ready for Analysis',
      version: 1, pageCount: metadata.pages, structure
    });
    await DocumentVersion.create({ organizationId:req.user.organizationId, documentId:doc._id, versionNo:doc.version, title:doc.title, description:doc.description, category:doc.category, format:doc.format, extractedText:text, structure, createdBy:req.user._id });
    await audit(req,'document.uploaded','document',doc._id,doc._id,{versionNo:doc.version,format:doc.format,size:doc.size});
    await logActivity({ organizationId: req.user.organizationId, actorId: req.user._id, action: 'document.uploaded', entityType: 'document', entityId: doc._id, summary: `${req.user.name} uploaded ${doc.title}` });
    return res.status(201).json({ document: publicDocument(doc), extractedCharacters: text.length });
  } catch (error) { if (savedPath) await removePrivateFile(savedPath); next(error); }
});
router.post('/paste', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const text = String(req.body.content || '').trim();
    if (!title || title.length > 180) return res.status(400).json({ message: 'Enter a document title (up to 180 characters).' });
    if (!text || text.length > 500000) return res.status(400).json({ message: 'Paste content between 1 and 500,000 characters.' });
    const storagePath = await storePrivateFile(Buffer.from(text,'utf8'), '.txt');
    const doc = await Document.create({ organizationId:req.user.organizationId, ownerId:req.user._id, title, description:String(req.body.description||'').slice(0,1200), category:String(req.body.category||'General').slice(0,80), format:'text', originalName:`${title}.txt`, storagePath, mimeType:'text/plain', size:Buffer.byteLength(text), extractedText:text, extractionStatus:'complete', status:'Ready for Analysis' });
    await DocumentVersion.create({organizationId:req.user.organizationId,documentId:doc._id,versionNo:doc.version,title:doc.title,description:doc.description,category:doc.category,format:doc.format,extractedText:text,structure:{},createdBy:req.user._id});
    await logActivity({ organizationId:req.user.organizationId, actorId:req.user._id, action:'document.created', entityType:'document', entityId:doc._id, summary:`${req.user.name} created ${doc.title} from pasted content` });
    res.status(201).json({ document:publicDocument(doc), extractedCharacters:text.length });
  } catch(error){ next(error); }
});
router.get('/', async (req,res,next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page,10)||1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit,10)||12));
    const filter = { ...scope(req) };
    const sortKey = ['updatedAt','createdAt','title'].includes(req.query.sort) ? req.query.sort : 'updatedAt';
    const sortDirection = req.query.direction === 'asc' ? 1 : -1;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.format && req.query.format !== 'all') filter.format = req.query.format;
    if (req.query.q) { const term = String(req.query.q).slice(0,80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ title: { $regex: term, $options:'i' } }, { originalName: { $regex: term, $options:'i' } }]; }
    const [documents,total] = await Promise.all([Document.find(filter).populate('ownerId','name email').sort({[sortKey]:sortDirection}).skip((page-1)*limit).limit(limit),Document.countDocuments(filter)]);
    res.json({ documents:documents.map(d=>({...publicDocument(d),owner:d.ownerId})), pagination:{page,limit,total,pages:Math.ceil(total/limit)} });
  } catch(error){ next(error); }
});
router.get('/:id/file',async(req,res,next)=>{
  try{
    const doc=await Document.findOne({_id:req.params.id,...scope(req)}).select('+storagePath');
    if(!doc)return res.status(404).json({message:'Document not found.'});
    res.type(doc.mimeType||'application/octet-stream').set('X-Content-Type-Options','nosniff').set('Content-Disposition',`attachment; filename="${doc.originalName.replace(/["\\\\]/g,'')}"`).set('Cache-Control','private, no-store');
    res.sendFile(path.resolve(doc.storagePath));
  }catch(error){next(error);}
});
router.post('/:id/archive',async(req,res,next)=>{
  try{
    const doc=await Document.findOneAndUpdate({_id:req.params.id,...scope(req)},{$set:{status:'Archived'}},{new:true});
    if(!doc)return res.status(404).json({message:'Document not found.'});
    await audit(req,'document.archived','document',doc._id,doc._id,{status:'Archived'});
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'document.archived',entityType:'document',entityId:doc._id,summary:`${req.user.name} archived ${doc.title}`});
    res.json({document:publicDocument(doc)});
  }catch(error){next(error);}
});
router.get('/:id/versions',async(req,res,next)=>{
  try{
    const doc=await Document.findOne({_id:req.params.id,...scope(req)});
    if(!doc)return res.status(404).json({message:'Document not found.'});
    const versions=await DocumentVersion.find({documentId:doc._id,organizationId:req.user.organizationId}).select('-extractedText').populate('createdBy','name').sort({versionNo:-1});
    res.json({versions});
  }catch(error){next(error);}
});
router.get('/:id', async(req,res,next)=>{
  try {
    const doc = await Document.findOne({ _id:req.params.id, ...scope(req) }).select('+extractedText');
    if(!doc) return res.status(404).json({message:'Document not found.'});
    res.json({document:publicDocument(doc),content:doc.extractedText});
  } catch(error){ next(error); }
});
router.patch('/:id', async(req,res,next)=>{
  try {
    const allowed = {};
    if(typeof req.body.title==='string' && req.body.title.trim()) allowed.title=req.body.title.trim().slice(0,180);
    if(typeof req.body.description==='string') allowed.description=req.body.description.slice(0,1200);
    if(typeof req.body.category==='string') allowed.category=req.body.category.slice(0,80);
    if(!Object.keys(allowed).length) return res.status(400).json({message:'No valid document changes were provided.'});
    const doc=await Document.findOne({_id:req.params.id,...scope(req)}).select('+extractedText');
    if(!doc) return res.status(404).json({message:'Document not found.'});
    Object.assign(doc,allowed); doc.version += 1; doc.analysisStatus='not_run'; doc.latestAnalysisAt=null; await doc.save();
    await DocumentVersion.create({organizationId:req.user.organizationId,documentId:doc._id,versionNo:doc.version,title:doc.title,description:doc.description,category:doc.category,format:doc.format,extractedText:doc.extractedText,structure:doc.structure,createdBy:req.user._id});
    await audit(req,'document.metadata_updated','document',doc._id,doc._id,{versionNo:doc.version,fields:Object.keys(allowed)});
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'document.updated',entityType:'document',entityId:doc._id,summary:`${req.user.name} updated ${doc.title}`});
    res.json({document:publicDocument(doc)});
  }catch(error){next(error);}
});
router.delete('/:id',async(req,res,next)=>{
  try {
    const doc=await Document.findOne({_id:req.params.id,...scope(req)}).select('+storagePath');
    if(!doc) return res.status(404).json({message:'Document not found or you do not have access.'});
    await Document.deleteOne({_id:doc._id});
    await DocumentVersion.deleteMany({documentId:doc._id,organizationId:req.user.organizationId});
    await removePrivateFile(doc.storagePath);
    await logActivity({organizationId:req.user.organizationId,actorId:req.user._id,action:'document.deleted',entityType:'document',entityId:doc._id,summary:`${req.user.name} deleted ${doc.title}`});
    res.json({message:'Document deleted.'});
  }catch(error){next(error);}
});
router.post('/:id/extract',async(req,res,next)=>{
  try {
    const doc=await Document.findOne({_id:req.params.id,...scope(req)}).select('+storagePath');
    if(!doc) return res.status(404).json({message:'Document not found.'});
    const { readFile } = await import('node:fs/promises');
    const buffer=await readFile(doc.storagePath);
    const { text,metadata,structure }=await extractBuffer(buffer,path.extname(doc.storagePath));
    doc.extractedText=text; doc.pageCount=metadata.pages; doc.structure=structure; doc.extractionStatus='complete'; doc.extractionError=''; doc.status='Ready for Analysis'; await doc.save();
    res.json({document:publicDocument(doc),extractedCharacters:text.length,metadata});
  }catch(error){next(error);}
});
export default router;

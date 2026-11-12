import mongoose from 'mongoose';
const documentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 1200, default: '' },
  category: { type: String, trim: true, maxlength: 80, default: 'General' },
  format: { type: String, enum: ['pdf','docx','txt','md','html','text'], required: true },
  originalName: { type: String, default: '' },
  storagePath: { type: String, required: true, select: false },
  mimeType: { type: String, default: 'text/plain' },
  size: { type: Number, default: 0 },
  extractedText: { type: String, default: '', select: false },
  extractionStatus: { type: String, enum: ['complete','failed','not_started'], default: 'not_started' },
  extractionError: { type: String, default: '' },
  status: { type: String, enum: ['Draft','Uploaded','Ready for Analysis','In Review','Changes Requested','Approved','Archived','Revised','Published'], default: 'Uploaded' },
  analysisStatus: { type: String, enum: ['not_run','pending','complete','failed'], default: 'not_run' },
  latestAnalysisAt: { type: Date, default: null },
  version: { type: Number, default: 1 },
  pageCount: { type: Number, default: null },
  structure: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
documentSchema.index({ organizationId: 1, ownerId: 1, updatedAt: -1 });
documentSchema.index({ organizationId: 1, title: 'text', originalName: 'text' });
export default mongoose.model('Document', documentSchema);

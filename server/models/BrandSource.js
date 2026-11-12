import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  originalName: { type: String, required: true },
  storagePath: { type: String, required: true, select: false },
  extractedText: { type: String, default: '', select: false },
  pageCount: { type: Number, default: null },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['active','archived','failed'], default: 'active' },
  processingStatus: { type: String, enum: ['complete','failed'], default: 'complete' },
  extractionError: { type: String, default: '' }
}, { timestamps: true });
schema.index({ organizationId:  1, status: 1, version: -1 });
export default mongoose.model('BrandSource', schema);

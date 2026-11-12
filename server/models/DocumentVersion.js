import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  versionNo: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'General' },
  format: { type: String, required: true },
  extractedText: { type: String, default: '' },
  structure: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changeDescription: { type: String, default: 'Document version created', maxlength: 300 }
}, { timestamps: true });
schema.index({ documentId: 1, versionNo: 1 }, { unique: true });
export default mongoose.model('DocumentVersion', schema);

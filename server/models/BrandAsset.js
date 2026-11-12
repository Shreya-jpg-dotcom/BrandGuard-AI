import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, enum: ['logo','palette','font','other'], required: true },
  description: { type: String, default: '', maxlength: 1000 },
  usageGuidelines: { type: String, default: '', maxlength: 1500 },
  storagePath: { type: String, required: true, select: false },
  originalName: { type: String, required: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  status: { type: String, enum: ['active','archived'], default: 'active' }
}, { timestamps: true });
export default mongoose.model('BrandAsset', schema);

import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  claimKey: { type: String, required: true, trim: true, maxlength: 120 },
  claim: { type: String, required: true, trim: true, maxlength: 500 },
  value: { type: String, required: true, trim: true, maxlength: 1000 },
  description: { type: String, default: '', maxlength: 1200 },
  sourceDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'BrandSource', default: null },
  sourceReference: { type: String, default: '', maxlength: 300 },
  validFrom: { type: Date, default: null },
  validUntil: { type: Date, default: null },
  status: { type: String, enum: ['active','expired','archived'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
schema.index({ organizationId: 1, claimKey: 1 });
export default mongoose.model('ApprovedFact', schema);

import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, maxlength: 100 },
  entityType: { type: String, default: '', maxlength: 80 },
  entityId: { type: String, default: '' },
  summary: { type: String, required: true, maxlength: 300 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
schema.index({ organizationId: 1, createdAt: -1 });
export default mongoose.model('ActivityLog', schema);

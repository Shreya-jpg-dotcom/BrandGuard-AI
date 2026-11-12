import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null }
}, { timestamps: true });
schema.index({ tokenHash: 1 }, { unique: true });
export default mongoose.model('EmployeeInvitation', schema);

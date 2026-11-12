import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  preferredTerm: { type: String, trim: true, maxlength: 120, default: '' },
  bannedTerm: { type: String, trim: true, maxlength: 120, default: '' },
  aliases: [{ type: String, trim: true, maxlength: 120 }],
  category: { type: String, trim: true, maxlength: 80, default: 'General' },
  explanation: { type: String, trim: true, maxlength: 1000, default: '' },
  usageNotes: { type: String, trim: true, maxlength: 1000, default: '' },
  sourceReference: { type: String, trim: true, maxlength: 300, default: '' },
  status: { type: String, enum: ['active','archived'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
schema.index({ organizationId: 1, preferredTerm: 1, bannedTerm: 1 });
export default mongoose.model('Terminology', schema);

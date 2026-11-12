import mongoose from 'mongoose';

const findingSchema = new mongoose.Schema({
  issueId: { type: String, required: true },
  category: { type: String, enum: ['tone','terminology','fact','claim','accessibility','visual','messaging','grammar'], required: true },
  severity: { type: String, enum: ['critical','major','minor','info'], required: true },
  title: { type: String, required: true, maxlength: 180 },
  span: { start: { type: Number, default: null }, end: { type: Number, default: null } },
  problematicText: { type: String, default: '' },
  finding: { type: String, required: true, maxlength: 1200 },
  explanation: { type: String, required: true, maxlength: 2000 },
  source: { document: String, page: Number, section: String, passageId: String, verified: { type: Boolean, default: false } },
  evidenceQuote: { type: String, default: '' },
  suggestedCorrection: { type: String, default: '' },
  reason: { type: String, default: '' },
  confidence: { type: Number, min: 0, max: 1, default: 0.7 },
  status: { type: String, enum: ['open','accepted','dismissed','needs_human_judgement'], default: 'open' },
  resolutionReason: { type: String, default: '', maxlength: 1000 },
  method: { type: String, enum: ['deterministic','ai'], required: true }
}, { _id: false });

const dimensionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  score: { type: Number, min: 0, max: 100, default: null },
  assessed: { type: Boolean, default: false },
  coverage: { type: Number, min: 0, max: 100, default: 0 },
  findings: { type: Number, default: 0 }
}, { _id: false });

const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  documentVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentVersion', default: null },
  documentVersion: { type: Number, required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['complete','partial','failed'], default: 'complete' },
  method: { type: String, enum: ['ai-assisted','deterministic'], required: true },
  provider: { type: String, default: 'none' },
  model: { type: String, default: 'deterministic-rules-v1' },
  scoringVersion: { type: String, default: '1.0.0' },
  overallScore: { type: Number, min: 0, max: 100, default: null },
  complianceStatus: { type: String, default: 'Not assessed' },
  dimensions: [dimensionSchema],
  coverage: { type: Number, min: 0, max: 100, default: 0 },
  findings: [findingSchema],
  summary: { type: String, default: '' },
  warnings: [{ type: String }]
}, { timestamps: true });

schema.index({ organizationId: 1, documentId: 1, createdAt: -1 });
export default mongoose.model('Analysis', schema);

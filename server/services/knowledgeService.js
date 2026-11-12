import BrandSource from '../models/BrandSource.js';
import ApprovedFact from '../models/ApprovedFact.js';
import Terminology from '../models/Terminology.js';

export async function getActiveFacts(organizationId, now = new Date()) {
  return ApprovedFact.find({ organizationId, status: 'active', $or: [{ validFrom: null }, { validFrom: { $lte: now } }], $and: [{ $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }] }).lean();
}
export async function getActiveTerminology(organizationId) {
  return Terminology.find({ organizationId, status: 'active' }).lean();
}
export async function getActiveGuidelines(organizationId) {
  return BrandSource.find({ organizationId, status: 'active', processingStatus: 'complete' }).select('+extractedText').lean();
}

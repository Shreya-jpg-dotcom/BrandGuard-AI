import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Analysis from '../models/Analysis.js';
import CorrectionSuggestion from '../models/CorrectionSuggestion.js';
import Review from '../models/Review.js';
import Document from '../models/Document.js';
import ApprovedFact from '../models/ApprovedFact.js';
import Terminology from '../models/Terminology.js';
import BrandSource from '../models/BrandSource.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/insights', async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const [analyses, suggestions, reviews, documents, activeFacts, activeTerms, activeGuidelines] = await Promise.all([
      Analysis.find({ organizationId }).select('findings createdAt documentId requestedBy').populate('requestedBy', 'name').lean(),
      CorrectionSuggestion.find({ organizationId }).select('status createdAt').lean(),
      Review.find({ organizationId }).select('status submittedAt decisions documentId creatorId').populate('creatorId', 'name').lean(),
      Document.find({ organizationId }).select('ownerId title').populate('ownerId', 'name').lean(),
      ApprovedFact.countDocuments({ organizationId, status: 'active' }),
      Terminology.countDocuments({ organizationId, status: 'active' }),
      BrandSource.countDocuments({ organizationId, status: 'active', processingStatus: 'complete' })
    ]);

    const categories = new Map();
    const rules = new Map();
    const byEmployee = new Map();
    for (const report of analyses) {
      const owner = report.requestedBy?.name || 'Unknown contributor';
      for (const finding of report.findings || []) {
        categories.set(finding.category, (categories.get(finding.category) || 0) + 1);
        const label = finding.title || finding.category;
        rules.set(label, (rules.get(label) || 0) + 1);
        byEmployee.set(owner, (byEmployee.get(owner) || 0) + 1);
      }
    }
    const suggestionCount = suggestions.length;
    const appliedCount = suggestions.filter(item => item.status === 'applied').length;
    const decidedReviews = reviews.filter(review => (review.decisions || []).length > 0);
    const overrides = reviews.reduce((n, review) => n + (review.decisions || []).filter(d => d.decision === 'override').length, 0);
    const changesRequested = reviews.filter(review => (review.decisions || []).some(d => d.decision === 'changes_requested')).length;
    const approvedDurations = reviews.flatMap(review => (review.decisions || []).filter(d => d.decision === 'approved' || d.decision === 'override').map(d => Math.max(0, new Date(d.createdAt).getTime() - new Date(review.submittedAt).getTime())));
    const averageApprovalHours = approvedDurations.length ? Math.round(approvedDurations.reduce((a, b) => a + b, 0) / approvedDurations.length / 3600000 * 10) / 10 : null;
    const knowledgeCoverage = { activeFacts, activeTerminology: activeTerms, activeGuidelines, hasApprovedKnowledge: Boolean(activeFacts + activeTerms + activeGuidelines) };

    res.json({
      totals: { documents: documents.length, analyses: analyses.length, findings: analyses.reduce((n, a) => n + (a.findings?.length || 0), 0), reviews: reviews.length },
      mostViolatedRules: [...rules].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      issuesByCategory: [...categories].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
      issuesByContributor: [...byEmployee].map(([contributor, count]) => ({ contributor, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      suggestions: { total: suggestionCount, applied: appliedCount, acceptanceRate: suggestionCount ? Math.round(appliedCount / suggestionCount * 100) : null },
      reviews: { total: reviews.length, overrideCount: overrides, overrideRate: reviews.length ? Math.round(overrides / reviews.length * 100) : null, reworkRate: reviews.length ? Math.round(changesRequested / reviews.length * 100) : null, averageApprovalHours, decided: decidedReviews.length },
      knowledgeCoverage
    });
  } catch (error) { next(error); }
});

export default router;

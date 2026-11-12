import { randomUUID } from 'node:crypto';

const severityPenalty = { critical: 25, major: 12, minor: 5, info: 0 };
function finding(input) {
  return { issueId: randomUUID(), status: 'open', confidence: 1, method: 'deterministic', ...input };
}
function occurrences(text, term) {
  if (!term) return [];
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
  return [...text.matchAll(regex)].map(m => ({ start: m.index, end: m.index + m[0].length, value: m[0] }));
}
export function runDeterministicRules({ text, structure = {}, terminology = [], facts = [], guidelines = [] }) {
  const findings = [];
  const lower = text.toLowerCase();

  for (const rule of terminology) {
    if (rule.bannedTerm) for (const hit of occurrences(text, rule.bannedTerm)) {
      findings.push(finding({
        category: 'terminology', severity: 'major', title: 'Banned terminology detected',
        span: { start: hit.start, end: hit.end }, problematicText: hit.value,
        finding: `The document uses the banned term “${hit.value}”.`,
        explanation: rule.explanation || `The approved terminology record prohibits “${rule.bannedTerm}”.`,
        source: rule.sourceReference ? { document: 'Terminology guide', section: rule.sourceReference, verified: true } : null,
        evidenceQuote: rule.bannedTerm, suggestedCorrection: rule.preferredTerm || '',
        reason: rule.usageNotes || 'Use the approved terminology consistently.'
      }));
    }
    if (rule.preferredTerm && rule.aliases?.length) {
      for (const alias of rule.aliases) for (const hit of occurrences(text, alias)) {
        findings.push(finding({
          category: 'terminology', severity: 'minor', title: 'Preferred terminology available',
          span: { start: hit.start, end: hit.end }, problematicText: hit.value,
          finding: `“${hit.value}” is an alias; the preferred term is “${rule.preferredTerm}”.`,
          explanation: rule.explanation || 'The terminology register specifies a preferred term.',
          source: rule.sourceReference ? { document: 'Terminology guide', section: rule.sourceReference, verified: true } : null,
          evidenceQuote: `${rule.preferredTerm} (preferred)`, suggestedCorrection: rule.preferredTerm,
          reason: rule.usageNotes || 'Prefer the approved term.'
        }));
      }
    }
  }

  for (const fact of facts) {
    const approved = String(fact.value || '').trim();
    const claim = String(fact.claim || '').trim();
    if (!approved || !claim) continue;
    const claimIndex = lower.indexOf(claim.toLowerCase());
    if (claimIndex < 0) continue;
    const window = text.slice(claimIndex, Math.min(text.length, claimIndex + claim.length + 180));
    const valuePresent = window.toLowerCase().includes(approved.toLowerCase());
    if (!valuePresent) {
      const end = Math.min(text.length, claimIndex + claim.length);
      findings.push(finding({
        category: 'fact', severity: 'critical', title: 'Approved fact may conflict',
        span: { start: claimIndex, end }, problematicText: text.slice(claimIndex, end),
        finding: `The statement references “${claim}” but does not contain the currently approved value “${approved}”.`,
        explanation: fact.description || 'The statement should be checked against the current approved fact.',
        source: { document: fact.sourceDocumentId?.title || 'Approved facts register', section: fact.sourceReference || fact.claimKey || 'Approved fact', verified: true },
        evidenceQuote: `${claim}: ${approved}`, suggestedCorrection: `${claim}: ${approved}`,
        reason: 'Use the current approved value; verify surrounding wording before changing it.'
      }));
    }
  }

  const required = guidelines.flatMap(g => {
    const matches = [...String(g.extractedText || '').matchAll(/(?:required disclaimer|mandatory disclaimer|must include disclaimer)\s*[:\-]\s*([^\n.]{8,240})/gi)];
    return matches.map(m => ({ source: g, text: m[1].trim() }));
  });
  for (const item of required) if (item.text && !lower.includes(item.text.toLowerCase())) {
    findings.push(finding({
      category: 'messaging', severity: 'major', title: 'Required disclaimer not found',
      span: { start: null, end: null }, problematicText: '',
      finding: 'A required disclaimer identified in the active Brand Bible is not present in this document.',
      explanation: 'The active guideline source specifies disclaimer wording that could not be found in the draft.',
      source: { document: item.source.title, page: null, section: 'Required disclaimer', verified: true },
      evidenceQuote: item.text, suggestedCorrection: item.text,
      reason: 'Add the required wording after confirming it applies to this content.'
    }));
  }

  const images = structure.images || [];
  images.forEach((image, index) => {
    if (!String(image.alt || '').trim()) findings.push(finding({
      category: 'accessibility', severity: 'major', title: 'Image alternative text is missing',
      finding: `Image ${index + 1} has no alternative text.`,
      explanation: 'Alternative text helps people using screen readers understand meaningful images.',
      source: { document: 'WCAG 2.1 AA', section: '1.1.1 Non-text Content', verified: true },
      evidenceQuote: 'Non-text content requires a text alternative.', suggestedCorrection: 'Add concise, meaningful alt text.',
      reason: 'Describe the information or function conveyed by the image.'
    }));
  });
  const headings = structure.headings || [];
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) findings.push(finding({
      category: 'accessibility', severity: 'minor', title: 'Heading level skipped',
      span: { start: null, end: null }, finding: `Heading level jumps from H${headings[i - 1].level} to H${headings[i].level}.`,
      explanation: 'Heading levels should follow a logical hierarchy.',
      source: { document: 'WCAG 2.1 AA', section: '1.3.1 Info and Relationships', verified: true },
      evidenceQuote: `H${headings[i - 1].level} followed by H${headings[i].level}`, suggestedCorrection: `Use H${headings[i - 1].level + 1} or restructure the heading hierarchy.`,
      reason: 'A sequential heading outline improves navigation.'
    }));
  }
  (structure.links || []).forEach(link => {
    if (/^(click here|here|read more|learn more)$/i.test(String(link.text || '').trim())) findings.push(finding({
      category: 'accessibility', severity: 'minor', title: 'Vague link text',
      finding: `The link text “${link.text}” does not describe its destination.`,
      explanation: 'Link purpose should be understandable from its text or programmatic context.',
      source: { document: 'WCAG 2.1 AA', section: '2.4.4 Link Purpose (In Context)', verified: true },
      evidenceQuote: link.text, suggestedCorrection: 'Replace with descriptive link text.',
      reason: 'Name the destination or action clearly.'
    }));
  });

  const words = text.match(/\b[\w'-]+\b/g) || [];
  const longWords = words.filter(w => w.length >= 7).length;
  const longSentences = text.split(/[.!?]+/).filter(s => s.trim().split(/\s+/).length > 30).length;
  const readability = words.length ? Math.max(0, Math.min(100, 100 - (longWords / words.length * 100) - longSentences * 3)) : null;
  if (longSentences > 0) findings.push(finding({
    category: 'accessibility', severity: 'info', title: 'Long sentences may affect readability',
    finding: `${longSentences} sentence(s) contain more than 30 words.`,
    explanation: 'Long sentences can make content harder to scan and understand.',
    source: null, evidenceQuote: '', suggestedCorrection: 'Consider splitting long sentences into shorter statements.',
    reason: 'Improve readability without changing the intended meaning.', confidence: 0.85
  }));

  return { findings, metrics: { wordCount: words.length, readabilityIndicator: readability, headingsChecked: headings.length, linksChecked: (structure.links || []).length, imagesChecked: images.length } };
}

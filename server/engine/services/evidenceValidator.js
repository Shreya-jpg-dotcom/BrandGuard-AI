export function validateAiFindings(items, { content, passages, facts, terminology }) {
  const allowedCategories = new Set(['tone','claim','messaging','grammar','fact','terminology','accessibility','visual']);
  const allowedSeverity = new Set(['critical','major','minor','info']);
  const sourceMap = new Map(passages.map(p => [p.passageId, p]));
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!allowedCategories.has(item.category) || !allowedSeverity.has(item.severity)) continue;
    const quote = String(item.evidenceQuote || '').trim();
    const span = item.span || {};
    const start = Number.isInteger(span.start) ? span.start : null;
    const end = Number.isInteger(span.end) ? span.end : null;
    if (start === null || end === null || start < 0 || end <= start || end > content.length) continue;
    const problematicText = content.slice(start, end);
    if (item.problematicText && problematicText !== item.problematicText) continue;
    const passage = sourceMap.get(item.passageId);
    let verified = false;
    let fact = null, term = null;
    if (passage && quote && passage.text.includes(quote)) verified = true;
    if (!verified && item.factId) {
      fact = facts.find(f => String(f._id) === String(item.factId)) || null;
      const factText = fact ? [fact.claim, fact.value, fact.description, fact.sourceReference].filter(Boolean).join(' ') : '';
      if (fact && quote && factText.includes(quote)) verified = true;
    }
    if (!verified && item.terminologyId) {
      term = terminology.find(t => String(t._id) === String(item.terminologyId)) || null;
      const termText = term ? [term.preferredTerm, term.bannedTerm, ...(term.aliases || []), term.explanation, term.usageNotes, term.sourceReference].filter(Boolean).join(' ') : '';
      if (term && quote && termText.includes(quote)) verified = true;
    }
    result.push({
      category: item.category, severity: item.severity, title: String(item.title || 'Potential brand issue').slice(0,180),
      span: { start, end }, problematicText, finding: String(item.finding || 'Potential issue identified.').slice(0,1200),
      explanation: String(item.explanation || 'Further review is recommended.').slice(0,2000),
      source: verified ? { document: passage?.document || (fact ? 'Approved facts register' : term ? 'Terminology register' : item.sourceDocument || 'Approved knowledge source'), page: passage?.page ?? null, section: passage?.section || fact?.sourceReference || term?.sourceReference || '', passageId: passage?.passageId || '', verified: true } : null,
      evidenceQuote: verified ? quote : '',
      suggestedCorrection: String(item.suggestedCorrection || '').slice(0,1000),
      reason: String(item.reason || '').slice(0,1000),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
      status: verified ? 'open' : 'needs_human_judgement', method: 'ai',
      finding: verified ? String(item.finding || 'Potential issue identified.') : 'Needs human judgement — no verified supporting source found.'
    });
  }
  return result;
}

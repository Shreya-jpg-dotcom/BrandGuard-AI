import { getActiveFacts, getActiveTerminology, getActiveGuidelines } from '../../services/knowledgeService.js';

function terms(text) {
  return new Set((String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || []));
}
function rankPassages(content, sources, limit = 8) {
  const query = terms(content);
  const passages = [];
  for (const source of sources) {
    const chunks = String(source.extractedText || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    chunks.forEach((text, index) => {
      const tokens = terms(text);
      let score = 0;
      for (const token of query) if (tokens.has(token)) score++;
      if (score) passages.push({
        passageId: `${source._id}:${index}`, document: source.title, version: source.version,
        page: null, section: `Passage ${index + 1}`, text, score
      });
    });
  }
  return passages.sort((a,b)=>b.score-a.score).slice(0,limit);
}
export async function retrieveBrandKnowledge(organizationId, content) {
  const [facts, terminology, guidelines] = await Promise.all([
    getActiveFacts(organizationId), getActiveTerminology(organizationId), getActiveGuidelines(organizationId)
  ]);
  return {
    facts,
    terminology,
    guidelines,
    passages: rankPassages(content, guidelines),
    assets: []
  };
}

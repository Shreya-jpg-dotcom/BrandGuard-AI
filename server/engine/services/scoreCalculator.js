export const SCORING_VERSION = '1.0.0';
const dimensions = [
  ['tone','Tone and Voice',15,['tone']],
  ['terminology','Terminology',20,['terminology']],
  ['fact','Fact Accuracy',25,['fact','claim']],
  ['messaging','Messaging',20,['messaging']],
  ['accessibility','Accessibility',10,['accessibility']],
  ['visual','Visual Consistency',10,['visual']]
];
const penalties = { critical:25, major:12, minor:5, info:0 };
export function calculateScore(findings, coverage = {}) {
  const scored = dimensions.map(([key,label,weight,categories]) => {
    const assessed = Boolean(coverage[key]);
    const relevant = findings.filter(f => categories.includes(f.category));
    const score = assessed ? Math.max(0, 100 - relevant.reduce((sum,f)=>sum+(penalties[f.severity] ?? 0),0)) : null;
    return { key,label,weight,score,assessed,coverage: assessed ? 100 : 0,findings: relevant.length };
  });
  const available = scored.filter(d=>d.assessed);
  const totalWeight = available.reduce((n,d)=>n+d.weight,0);
  const rawScore = totalWeight ? Math.round(available.reduce((n,d)=>n+d.score*d.weight,0)/totalWeight) : null;
  // An incomplete assessment cannot receive a perfect score; keep this ceiling explicit in coverage metadata.
  const overallScore = rawScore === null ? null : totalWeight < 100 ? Math.min(89, rawScore) : rawScore;
  const status = overallScore === null ? 'Not assessed' : totalWeight < 100 ? 'Partial assessment' : overallScore >= 90 ? 'Strong' : overallScore >= 75 ? 'Good' : overallScore >= 60 ? 'Needs Improvement' : overallScore >= 40 ? 'Significant Issues' : 'High Risk';
  return { dimensions: scored, overallScore, complianceStatus: status, coverage: Math.round(available.reduce((n,d)=>n+d.weight,0)) };
}

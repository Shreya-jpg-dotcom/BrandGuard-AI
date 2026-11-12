import test from 'node:test';
import assert from 'node:assert/strict';
import { runDeterministicRules } from '../engine/rules/deterministicRules.js';
import { calculateScore } from '../engine/services/scoreCalculator.js';
import { validateAiFindings } from '../engine/services/evidenceValidator.js';

test('banned terminology produces exact source offsets and a specific finding', () => {
  const text = 'Our service is cheap and reliable.';
  const { findings } = runDeterministicRules({
    text, terminology: [{ bannedTerm: 'cheap', preferredTerm: 'affordable', explanation: 'Use approved pricing language.' }]
  });
  assert.equal(findings.length, 1);
  assert.equal(text.slice(findings[0].span.start, findings[0].span.end), 'cheap');
  assert.equal(findings[0].suggestedCorrection, 'affordable');
  assert.equal(findings[0].severity, 'major');
});

test('fact mismatch is flagged only when the approved claim occurs in the draft', () => {
  const { findings } = runDeterministicRules({
    text: 'The subscription price is $49 per month.',
    facts: [{ claim: 'subscription price', value: '$59', claimKey: 'price' }]
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].category, 'fact');
  assert.equal(findings[0].severity, 'critical');
});

test('score excludes unassessed dimensions and changes with actual penalties', () => {
  const clean = calculateScore([], { terminology: true });
  assert.equal(clean.overallScore, 89);
  assert.equal(clean.dimensions.find(d => d.key === 'visual').score, null);
  const flagged = calculateScore([{ category:'terminology', severity:'major' }], { terminology:true });
  assert.equal(flagged.overallScore, 88);
});

test('AI findings without verifiable evidence are downgraded to human judgement', () => {
  const [result] = validateAiFindings([{
    category:'claim', severity:'critical', title:'Unsupported claim',
    span:{start:0,end:5}, problematicText:'best!', finding:'Superlative claim.',
    evidenceQuote:'made up source', passageId:'missing'
  }], { content:'best! product', passages:[], facts:[], terminology:[] });
  assert.equal(result.status, 'needs_human_judgement');
  assert.equal(result.source, null);
  assert.match(result.finding, /Needs human judgement/);
});


test('an approved fact identifier alone is not enough to verify a fabricated quote', () => {
  const fact = { _id:'fact-1', claim:'Annual revenue', value:'$2m', description:'FY2026 approved figure' };
  const [result] = validateAiFindings([{
    category:'fact', severity:'major', title:'Fact issue',
    span:{start:0,end:7}, problematicText:'Revenue', finding:'Possible mismatch.',
    factId:'fact-1', evidenceQuote:'Invented evidence'
  }], { content:'Revenue increased', passages:[], facts:[fact], terminology:[] });
  assert.equal(result.status, 'needs_human_judgement');
  assert.equal(result.source, null);
});

test('scoring uses the configured six-dimension weights and exact score labels', () => {
  const clean = calculateScore([], { tone:true, terminology:true, fact:true, messaging:true, accessibility:true, visual:true });
  assert.equal(clean.overallScore, 100);
  assert.equal(clean.complianceStatus, 'Strong');
  const critical = calculateScore([{ category:'fact', severity:'critical' }], { tone:true, terminology:true, fact:true, messaging:true, accessibility:true, visual:true });
  assert.equal(critical.overallScore, 94);
});

test('scores never fall below zero and informational findings carry no penalty', () => {
  const findings = Array.from({ length: 5 }, () => ({ category:'fact', severity:'critical' }));
  assert.equal(calculateScore(findings, { fact:true }).overallScore, 0);
  assert.equal(calculateScore([{ category:'fact', severity:'info' }], { fact:true }).overallScore, 89);
});

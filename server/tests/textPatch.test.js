import test from 'node:test';
import assert from 'node:assert/strict';
import {applyExactTextPatch} from '../services/textPatchService.js';
test('replaces only the selected exact span',()=>{
 assert.equal(applyExactTextPatch('Hello cheap world',6,11,'cheap','affordable'),'Hello affordable world');
});
test('rejects stale spans instead of changing unrelated text',()=>{
 assert.throws(()=>applyExactTextPatch('Hello budget world',6,11,'cheap','affordable'),{status:409});
});
test('rejects invalid offsets',()=>{
 assert.throws(()=>applyExactTextPatch('abc',-1,2,'ab','x'),{status:400});
});

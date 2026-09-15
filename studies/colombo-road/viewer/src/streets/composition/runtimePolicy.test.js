import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredLoadsReady,shouldScheduleFrame} from './runtimePolicy.js';

test('architecture, landscape and traffic are all required before ready',()=>{
  const fulfilled={status:'fulfilled'},rejected={status:'rejected'};
  assert.equal(requiredLoadsReady([fulfilled,fulfilled,rejected,fulfilled]),true);
  assert.equal(requiredLoadsReady([fulfilled,fulfilled,fulfilled,rejected]),false);
  assert.equal(requiredLoadsReady([fulfilled,rejected,fulfilled,fulfilled]),false);
});

test('hidden or reduced-motion state does not keep tour or ambient loops scheduled',()=>{
  assert.equal(shouldScheduleFrame({animate:false,touring:true,traffic:true,wind:true,automatic:true}),false);
  assert.equal(shouldScheduleFrame({animate:true,touring:false,traffic:false,wind:false,automatic:false}),false);
  assert.equal(shouldScheduleFrame({animate:true,touring:true,traffic:false,wind:false,automatic:false}),true);
});

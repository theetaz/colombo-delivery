import test from 'node:test';
import assert from 'node:assert/strict';
import {solveKnee3D} from './trafficRig.js';

test('three-dimensional knee solution preserves both bone lengths',()=>{const hip=[-.13,1.03,-.36],pole=[-.10,.5129,-.3144],upper=.52,lower=.52;for(let i=0;i<144;i++){const phase=i/144*Math.PI*2,target=[-.07,.39+.24*Math.sin(phase),-.05+.24*Math.cos(phase)],knee=solveKnee3D(hip,target,upper,lower,pole);assert.ok(Math.abs(Math.hypot(...knee.map((v,j)=>v-hip[j]))-upper)<1e-9);assert.ok(Math.abs(Math.hypot(...target.map((v,j)=>v-knee[j]))-lower)<1e-9);}});

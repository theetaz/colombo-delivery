import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshBasicMaterial} from 'three';
import {createRoadHeightSampler} from './road-height.js';

function mesh(vertices,{indices,layer=true}={}){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));
  if(indices)geometry.setIndex(indices);
  const object=new Mesh(geometry,new MeshBasicMaterial());
  if(layer)object.userData.asset_layer='01 Roads';
  return object;
}

test('interpolates a sloping indexed road triangle and returns null outside it',()=>{
  const root=new Group();root.add(mesh([0,1,0,10,3,0,0,5,10],{indices:[0,1,2]}));
  const height=createRoadHeightSampler(root);
  assert.ok(Math.abs(height(2,3)-2.6)<1e-9);
  assert.equal(height(9,9),null);
  assert.equal(height(NaN,0),null);
});

test('applies the complete world transform inherited by a road mesh',()=>{
  const root=new Group(),parent=new Group();
  parent.position.set(20,4,-12);parent.rotation.y=Math.PI/2;parent.scale.set(2,3,2);
  parent.add(mesh([0,0,0,4,0,0,0,2,4]));root.add(parent);
  const height=createRoadHeightSampler(root);
  assert.ok(Math.abs(height(24,-16)-7)<1e-8);
  assert.equal(height(18,-14),null);
});

test('ignores geometry outside the road asset layer and projected wall triangles',()=>{
  const root=new Group();
  root.add(mesh([0,50,0,10,50,0,0,50,10],{layer:false}));
  root.add(mesh([2,0,2,2,8,2,2,0,8]));
  assert.equal(createRoadHeightSampler(root)(2,2),null);
});

test('chooses the highest overlapping road surface for bridge crossings',()=>{
  const root=new Group();
  root.add(mesh([0,1,0,10,1,0,0,1,10]));
  root.add(mesh([0,7,0,10,7,0,0,7,10],{indices:[0,1,2]}));
  assert.ok(Math.abs(createRoadHeightSampler(root)(2,2)-7)<1e-10);
});

test('samples a shared edge consistently across indexed triangles and grid cells',()=>{
  const root=new Group();
  root.add(mesh([20,2,20,44,4,20,44,6,44,20,4,44],{indices:[0,1,2,0,2,3]}));
  const height=createRoadHeightSampler(root);
  assert.ok(Math.abs(height(32,32)-4)<1e-8);
  assert.ok(Math.abs(height(32,20)-3)<1e-8);
  assert.ok(Math.abs(height(32,44)-5)<1e-8);
});

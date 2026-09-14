import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const directory=new URL('../../public/cyclist/',import.meta.url);

export async function loadGeometry(file){
  const original=await readFile(new URL(file,directory));
  assert.equal(original.toString('ascii',0,4),'glTF');
  assert.equal(original.readUInt32LE(8),original.length);
  const jsonLength=original.readUInt32LE(12);
  const document=JSON.parse(original.toString('utf8',20,20+jsonLength));
  // Node has no image decoder. Keep the exact binary geometry, skin and
  // animation; omit only material/image definitions from this in-memory copy.
  delete document.images;delete document.textures;delete document.samplers;
  document.materials=document.materials?.map(()=>({}));
  let encoded=JSON.stringify(document);encoded+=' '.repeat((4-Buffer.byteLength(encoded)%4)%4);
  const json=Buffer.from(encoded),tail=original.subarray(20+jsonLength);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);
  header.writeUInt32LE(20+json.length+tail.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bytes=Buffer.concat([header,json,tail]);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
}


import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import * as THREE from '../dist/vendor/three.module.js';import {normalizeAssembly} from '../dist/geometry.mjs';
test('physical preview world coordinates match every original-mesh part bound used by gradients',()=>{
 const manifest=JSON.parse(readFileSync('dist/assets/duck.json'));const bytes=gunzipSync(readFileSync('dist/assets/duck.bin.gz'));const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);const geometries={};
 for(const [name,g]of Object.entries(manifest.geometries)){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,g.position.offset,g.position.count),3));geometries[name]=geo;}
 const robot=new THREE.Group();robot.rotation.x=-Math.PI/2;for(const p of manifest.instances){const mesh=new THREE.Mesh(geometries[p.mesh]);mesh.applyMatrix4(new THREE.Matrix4().fromArray(p.matrix));mesh.userData.part=p;robot.add(mesh)}normalizeAssembly(robot);
 for(const mesh of robot.children){const actual=new THREE.Box3().setFromObject(mesh,true),expected=mesh.userData.part.bounds;for(const key of ['min','max'])for(let i=0;i<3;i++)assert.ok(Math.abs(actual[key].getComponent(i)-expected[key][i])<.00001,`${mesh.userData.part.id} ${key} coordinate ${i} must match the original geometry's gradient domain`)}
});

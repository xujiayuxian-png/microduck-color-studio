import {Box3,Vector3} from './vendor/three.module.js';
export function normalizeAssembly(robot){const bounds=new Box3().setFromObject(robot,true),size=bounds.getSize(new Vector3());robot.scale.setScalar(3.5/size.y);const b=new Box3().setFromObject(robot,true),center=b.getCenter(new Vector3());robot.position.set(-center.x,-b.min.y,-center.z);robot.updateMatrixWorld(true);return robot;}

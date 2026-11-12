"""Convert official STL visuals + MJCF standing pose to a local indexed mesh pack."""
import json,struct,urllib.request,time,concurrent.futures,xml.etree.ElementTree as E
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation
ROOT=Path(__file__).parent.parent
SHA=json.loads((ROOT/'dist/assets/duck.json').read_text())['commit']
BASE=f'https://raw.githubusercontent.com/pollen-robotics/microduck_rl/{SHA}/'
ASSET='src/mjlab_microduck/robot/microduck/assets/'
xml=E.parse(ROOT/'reference/robot_walk.xml').getroot()
meshes=[x.attrib['file'] for x in xml.findall('./asset/mesh')]
cache=ROOT/'reference/stl';cache.mkdir(exist_ok=True)
def fetch(name):
 p=cache/name
 if p.exists():return name
 for i in range(4):
  try:
   p.write_bytes(urllib.request.urlopen(BASE+ASSET+name,timeout=35).read());return name
  except Exception:
   if i==3:raise
   time.sleep(i+1)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for name in pool.map(fetch,meshes):print('Fetched',name,flush=True)
# Compact geometry: unique flat-shaded position/normal pairs with indexed faces.
buffer=bytearray();geos={}
for name in meshes:
 data=(cache/name).read_bytes();n=struct.unpack_from('<I',data,80)[0]
 dt=np.dtype([('n','<f4',(3,)),('p','<f4',(3,3)),('a','<u2')])
 tris=np.frombuffer(data,dtype=dt,count=n,offset=84)
 pos=tris['p'].reshape(-1,3);norm=np.repeat(tris['n'],3,axis=0)
 a=np.round(np.concatenate([pos,norm],axis=1),7)
 a,idx=np.unique(a,axis=0,return_inverse=True)
 positions=a[:,:3].astype('<f4');normals=a[:,3:].astype('<f4');indices=idx.astype('<u4')
 meta={}
 for key,arr in [('position',positions),('normal',normals),('index',indices)]:
  meta[key]={'offset':len(buffer),'count':arr.size};buffer.extend(arr.tobytes())
 geos[name[:-4]]=meta

def transform(el):
 m=np.eye(4);m[:3,3]=np.fromstring(el.get('pos','0 0 0'),sep=' ')
 q=np.fromstring(el.get('quat','1 0 0 0'),sep=' ')
 m[:3,:3]=Rotation.from_quat([q[1],q[2],q[3],q[0]]).as_matrix();return m
scene=E.parse(ROOT/'reference/scene_walk.xml').getroot()
qpos=np.fromstring(scene.find(".//key[@name='STAND']").get('qpos'),sep=' ')
joints=xml.findall('.//worldbody//joint');angles=dict(zip([j.get('name') for j in joints],qpos[7:]))
body={'top_head_shell','bottom_head_shell','jaw','face_part','trunk_base','neck','neck_pitch','leg','motor_support','power_support','banana_pcb_locker','yaw_roll_motion'}
guards={'right_shell','left_shell','upper_leg_left','upper_leg_right','upper_leg_rigidity_plate'}
hips={'hip_l','yaw2roll','bearing_roll'}
feet={'foot_left','foot_right','ankle_left','ankle_right','soft_mouth_top','jaw_soft'}
# Soft beak contact surfaces are grouped with body, not feet.
body|={'soft_mouth_top','jaw_soft'};feet-={'soft_mouth_top','jaw_soft'}
def group(name):
 for k,s in [('body',body),('guards',guards),('hips',hips),('feet',feet),('eyes',{'noenoeil'}),('soles',{'sole_left','sole_right'})]:
  if name in s:return k
 return 'fixed'
materials={m.get('name'):[float(x) for x in m.get('rgba').split()] for m in xml.findall('./asset/material')}
instances=[]
def walk(el,parent):
 matrix=parent@transform(el)
 for j in el.findall('joint'):
  if j.get('name') in angles:
   pivot=np.fromstring(j.get('pos','0 0 0'),sep=' ');axis=np.fromstring(j.get('axis','0 0 1'),sep=' ')
   r=np.eye(4);r[:3,:3]=Rotation.from_rotvec(axis*angles[j.get('name')]).as_matrix();r[:3,3]=pivot-r[:3,:3]@pivot
   matrix=matrix@r
 for g in el.findall('geom'):
  if g.get('class')!='visual' or g.get('mesh') not in geos:continue
  name=g.get('mesh');instances.append({'mesh':name,'group':group(name),'matrix':(matrix@transform(g)).T.flatten().tolist(),'rgba':materials.get(g.get('material'),[.2,.2,.2,1])})
 for b in el.findall('body'):walk(b,matrix)
for b in xml.findall('./worldbody/body'):walk(b,np.eye(4))
model={'source':'https://github.com/pollen-robotics/microduck_rl','commit':SHA,'license':'CC BY-NC-SA 4.0','pose':'official STAND from scene_walk.xml','geometries':geos,'instances':instances}
(ROOT/'dist/assets/duck.json').write_text(json.dumps(model,separators=(',',':')))
(ROOT/'reference/model.bin').write_bytes(buffer)
import gzip
with gzip.open(ROOT/'dist/assets/duck.bin.gz','wb',compresslevel=9) as f:f.write(buffer)
(ROOT/'dist/assets/ATTRIBUTION.md').write_text(f'''# Microduck 3D model\n\nCopyright Pollen Robotics.\nSource: https://github.com/pollen-robotics/microduck_rl\nCommit: {SHA}\nLicense: https://creativecommons.org/licenses/by-nc-sa/4.0/\n\nModified: official STL visual meshes converted to indexed binary geometry, assembled with MJCF transforms in the official standing pose, and recolored. Converted mesh adaptation remains CC BY-NC-SA 4.0. These are visualization assets, not manufacturing instructions.\n''')
print(f'Packaged {len(geos)} geometries / {len(instances)} instances / {len(buffer):,} bytes')
print('Groups:',{g:sum(x['group']==g for x in instances) for g in {x['group'] for x in instances}})

import {wrapFrame} from './state.mjs';
import {compileAppearance,sampleCompiled} from './paint.mjs';
const W=840;
const lin=Array.from({length:256},(_,i)=>{const n=i/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});
const gamma=Array.from({length:4097},(_,i)=>{const n=i/4096;return Math.round(255*(n<=.0031308?n*12.92:1.055*n**(1/2.4)-.055))});
const srgb=n=>gamma[Math.max(0,Math.min(4096,Math.round(n*4096)))];
const unit=([x,y,z])=>{const n=Math.hypot(x,y,z)||1;return [x/n,y/n,z/n]};
export async function createFallbackViewer(container,onSelect,parts){
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','逐件渐变与材质的真实模型多视角预览');container.prepend(canvas);const ctx=canvas.getContext('2d');
 const response=await fetch('./assets/duck.json?v=2');if(!response.ok)throw Error('模型表面信息加载失败');const manifest=await response.json(),bounds=manifest.surfaceBounds;
 const cache=new Map(),pendingFrames=new Map(),byIndex=Object.fromEntries(parts.map(p=>[p.index,p]));
 let reference=false;
 let frame=3,config={},selected=[],zoom=1,width=1,height=1,auto=null,version=0,request=0,rendered;
 const light=unit([.6,.9,.7]),out=[0,0,0];
 async function imageData(url){const image=new Image();image.src=url;await image.decode();const temp=document.createElement('canvas');temp.width=temp.height=W;const c=temp.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);return c.getImageData(0,0,W,W).data;}
 async function load(n){n=wrapFrame(n);if(cache.has(n)){const data=cache.get(n);cache.delete(n);cache.set(n,data);return data}if(!pendingFrames.has(n))pendingFrames.set(n,Promise.all(['frame','position','normal'].map(type=>imageData(`./assets/views/${type}-${String(n).padStart(2,'0')}.png?v=2`))).then(([mask,pos,normal])=>{const data={mask,pos,normal};cache.set(n,data);while(cache.size>8){const remove=[...cache.keys()].find(key=>key!==3&&key!==frame&&key!==n);if(remove===undefined)break;cache.delete(remove)}return data}).finally(()=>pendingFrames.delete(n)));return pendingFrames.get(n)}
 await load(3);
 function colorize(n,value,highlight=false){
  const data=cache.get(n);if(!data)return null;const result=new ImageData(W,W),output=result.data;const compiled={};
  for(const p of parts){const a=compileAppearance(value[p.id]);const size=p.bounds.max.map((v,i)=>Math.max(.001,v-p.bounds.min[i]));a.factor=size.map((v,i)=>(bounds.max[i]-bounds.min[i])/v/255);a.offset=size.map((v,i)=>(bounds.min[i]-p.bounds.min[i])/v);a.specPower=8+(1-a.roughness)**3*160;compiled[p.index]=a;}
  const theta=n*Math.PI/12,view=unit([9*Math.cos(theta),2.25,9*Math.sin(theta)]),half=unit(light.map((l,i)=>l+view[i]));
  const marked=new Set(selected.map(id=>parts.find(p=>p.id===id)?.index));const mask=data.mask,pos=data.pos,normals=data.normal;
  for(let k=0;k<mask.length;k+=4){if(!mask[k+3])continue;const id=mask[k+1],a=compiled[id];if(!a)continue;
   const x=Math.max(0,Math.min(1,pos[k]*a.factor[0]+a.offset[0])),y=Math.max(0,Math.min(1,pos[k+1]*a.factor[1]+a.offset[1])),z=Math.max(0,Math.min(1,pos[k+2]*a.factor[2]+a.offset[2]));sampleCompiled(a,x,y,z,out);
   let nx=normals[k]/127.5-1,ny=normals[k+1]/127.5-1,nz=normals[k+2]/127.5-1;const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
   const ao=mask[k+2]/255,shade=Math.min(1.12,mask[k]/210)*ao,ndv=Math.abs(nx*view[0]+ny*view[1]+nz*view[2]);const spec=Math.pow(Math.max(0,nx*half[0]+ny*half[1]+nz*half[2]),a.specPower)*(1-a.roughness*.75);
   let diffuse=shade*(1-a.metalness*.35)+a.metalness*(.15+.25*Math.abs(ny)+.12*Math.sin(nz*10+nx*7+theta));
   const sheen=a.matIndex===2?(1-ndv)**2*.2:0;
   for(let channel=0;channel<3;channel++){
    const base=lin[Math.max(0,Math.min(255,Math.round(out[channel]*255)))];let value=base*(diffuse+sheen)+spec*(.06*(1-a.metalness)+base*a.metalness)*2.5+spec*a.clearcoat*.18;
    if(a.matIndex===5)value+=.045*(1-ndv)*(1+Math.sin((ny+nz)*7+channel*2))*base;
    if(a.matIndex===11){const bg=[.86,.86,.86][channel],fresnel=(1-ndv)**3;value=bg*(.48-.25*fresnel)+base*(.28+.5*fresnel)+spec*.65;}
    output[k+channel]=reference?Math.round(out[channel]*255):srgb(value);
   }
   output[k+3]=255;
   if(!reference&&highlight&&marked.has(id)){const pixel=k/4,px=pixel%W;if(px>0&&px<W-1&&(mask[k-3]!==id||mask[k+5]!==id||mask[k-W*4+1]!==id||mask[k+W*4+1]!==id)){output[k]=output[k]*.5+65;output[k+1]=output[k+1]*.5+83;output[k+2]=output[k+2]*.5+49;}}
  }
  const image=document.createElement('canvas');image.width=image.height=W;image.getContext('2d').putImageData(result,0,0);return image;
 }
 function layout(w,h,scale=zoom){const size=Math.min(w*1.16,h*1.02)*scale;return {size,x:(w-size)/2,y:(h-size)/2+3}}
 function paint(target,w,h,image,scale=zoom){target.clearRect(0,0,w,h);const l=layout(w,h,scale);target.save();target.translate(w*.5,l.y+l.size*.88);target.scale(1,.22);const shadow=target.createRadialGradient(0,0,0,0,0,l.size*.22);shadow.addColorStop(0,'rgba(77,95,56,.15)');shadow.addColorStop(1,'rgba(77,95,56,0)');target.fillStyle=shadow;target.fillRect(-l.size*.24,-l.size*.24,l.size*.48,l.size*.48);target.restore();target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';target.drawImage(image,l.x,l.y,l.size,l.size)}
 function draw(recolor=true){if(recolor||!rendered)rendered=colorize(frame,config,true);if(rendered)paint(ctx,width,height,rendered)}
 const resize=new ResizeObserver(()=>{const r=container.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);width=r.width;height=r.height;canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);if(Object.keys(config).length)draw(false)});resize.observe(container);
 async function show(n){n=wrapFrame(n);const current=++request;try{await load(n);if(current!==request)return;frame=n;draw();for(const neighbor of [n-1,n+1])load(neighbor).catch(()=>{})}catch{if(current===request)container.dispatchEvent(new CustomEvent('viewerror'))}}
 function stop(){if(auto){clearInterval(auto);auto=null}}
 let drag;
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,frame,moved:false};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const delta=e.clientX-drag.x;if(Math.abs(delta)>5){drag.moved=true;stop();show(drag.frame-Math.round(delta/18));document.querySelector('#auto-rotate').setAttribute('aria-pressed','false')}});
 canvas.addEventListener('pointerup',e=>{if(!drag)return;if(!drag.moved){const rect=canvas.getBoundingClientRect(),l=layout(width,height),x=Math.floor((e.clientX-rect.left-l.x)/l.size*W),y=Math.floor((e.clientY-rect.top-l.y)/l.size*W);if(x>=0&&x<W&&y>=0&&y<W){const data=cache.get(frame)?.mask,id=data?.[(y*W+x)*4+1];if(byIndex[id])onSelect(byIndex[id].id,{additive:e.ctrlKey||e.shiftKey||e.metaKey})}}drag=null});canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.7,Math.min(1.7,zoom-e.deltaY*.001));draw(false)},{passive:false});
 document.querySelector('.model-tag').textContent='真实模型 · 24 个视角';document.querySelector('.drag-hint').textContent='拖动切换视角 · 滚轮缩放 · 点击选件';
 for(const n of [0,6,12,2,4])load(n).catch(()=>{});
 return {ready:true,mode:'multiview',setReference(enabled){reference=enabled;draw()},setConfig(value){if(config!==value){config=value;version++;draw()}},select(ids){if(selected.join()!==ids.join()){selected=[...ids];if(Object.keys(config).length)draw()}},view(name){stop();zoom=1;show(({hero:3,front:0,side:6,back:12})[name]??3)},rotate(){if(auto){stop();return false}auto=setInterval(()=>show(frame+1),300);return true},snapshot(value=config,w=700,h=600){const before=reference;reference=false;try{const image=colorize(3,value,false),target=document.createElement('canvas');target.width=w;target.height=h;paint(target.getContext('2d'),w,h,image,1);return target.toDataURL('image/png')}finally{reference=before}}};
}

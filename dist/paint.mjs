export const PAINT_INDEX={solid:0,linear:1,radial:2,tri:3,rainbow:4};
export const MATERIAL_INDEX={matte:0,gloss:1,silk:2,metal:3,brushed:4,pearl:5,wood:6,marble:7,carbon:8,clay:9,frost:10,glass:11};
export function hexRGB(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)}
export function compileAppearance(a){return {...a,a:hexRGB(a.color),b:hexRGB(a.color2),c:hexRGB(a.color3),cos:Math.cos(a.angle*Math.PI/180),sin:Math.sin(a.angle*Math.PI/180),paintIndex:PAINT_INDEX[a.paint],matIndex:MATERIAL_INDEX[a.material]};}
const clamp=x=>Math.max(0,Math.min(1,x));
export function sampleCompiled(c,x,y,z,out){
 const u=z,v=y,t=clamp((u-.5)*c.cos+(v-.5)*c.sin+.5);let blend=0,left=c.a,right=c.b;
 if(c.paintIndex===1)blend=1-t;
 else if(c.paintIndex===2)blend=clamp(Math.hypot(u-.5,v-.5)*1.7);
 else if(c.paintIndex===3){if(t<.5){left=c.b;right=c.c;blend=t*2}else{left=c.c;right=c.a;blend=(t-.5)*2}}
 if(c.paintIndex===4){const h=((t*.86+.08)%1)*6;const f=h-Math.floor(h);const p=.24,q=1-f*.76,r=.24+f*.76;const cols=[[1,r,p],[q,1,p],[p,1,r],[p,q,1],[r,p,1],[1,p,q]][Math.floor(h)%6];out[0]=cols[0];out[1]=cols[1];out[2]=cols[2]}
 else for(let k=0;k<3;k++)out[k]=left[k]*(1-blend)+right[k]*blend;
 let texture=1;const scale=c.scale;
 if(c.matIndex===6){const grain=Math.sin((u*5+v*.4+Math.sin(v*8)*.18)*scale*6.283185);texture=.73+.22*(.5+.5*grain)+.04*Math.sin(u*170*scale)}
 else if(c.matIndex===7){const wave=.5+.5*Math.sin((u*4+v*.8+Math.sin(v*13)*.45+Math.sin(u*19+x*4)*.3)*scale*6.283185);texture=1-Math.pow(wave,14)*.6}
 else if(c.matIndex===8){const a=u*38*scale,b=v*38*scale;const check=(Math.floor(a)+Math.floor(b))%2;texture=(check?.66:.9)+.07*Math.sin((check?a:b)*6.283185*3)}
 else if(c.matIndex===4)texture=.91+.06*Math.sin(v*1100*scale)+.025*Math.sin(v*2387*scale);
 else if(c.matIndex===2)texture=.97+.03*Math.sin(v*450*scale);
 else if(c.matIndex===9||c.matIndex===10)texture=.94+.055*Math.sin(u*671*scale)*Math.sin(v*517*scale);
 for(let k=0;k<3;k++)out[k]=clamp(out[k]*texture);return out;
}
export function samplePaint(a,p){return sampleCompiled(compileAppearance(a),...p,[0,0,0])}
// Same continuous world-coordinate paint functions used by the physical renderer.
export const PAINT_GLSL=`
uniform vec3 uPaintA,uPaintB,uPaintC,uPartMin,uPartMax;
uniform float uPaintType,uTextureType,uPaintAngle,uTextureScale;
varying vec3 vPaintWorld;
vec3 studioPaint(vec3 point){
 vec3 p=clamp((point-uPartMin)/max(uPartMax-uPartMin,vec3(.001)),0.,1.);
 float u=p.z,v=p.y,theta=radians(uPaintAngle),t=clamp((u-.5)*cos(theta)+(v-.5)*sin(theta)+.5,0.,1.);
 vec3 col=uPaintA;
 if(uPaintType>.5&&uPaintType<1.5)col=mix(uPaintB,uPaintA,t);
 else if(uPaintType>1.5&&uPaintType<2.5)col=mix(uPaintA,uPaintB,clamp(length(vec2(u-.5,v-.5))*1.7,0.,1.));
 else if(uPaintType>2.5&&uPaintType<3.5)col=t<.5?mix(uPaintB,uPaintC,t*2.):mix(uPaintC,uPaintA,(t-.5)*2.);
 else if(uPaintType>3.5){float h=mod(t*.86+.08,1.);vec3 rgb=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);col=mix(vec3(.24),vec3(1.),rgb);}
 float s=uTextureScale,tex=1.;
 if(uTextureType>5.5&&uTextureType<6.5)tex=.73+.22*(.5+.5*sin((u*5.+v*.4+sin(v*8.)*.18)*s*6.283185))+.04*sin(u*170.*s);
 else if(uTextureType>6.5&&uTextureType<7.5){float wave=.5+.5*sin((u*4.+v*.8+sin(v*13.)*.45+sin(u*19.+p.x*4.)*.3)*s*6.283185);tex=1.-pow(wave,14.)*.6;}
 else if(uTextureType>7.5&&uTextureType<8.5){float a=u*38.*s,b=v*38.*s,c=mod(floor(a)+floor(b),2.);tex=mix(.9,.66,c)+.07*sin(mix(b,a,c)*6.283185*3.);}
 else if(uTextureType>3.5&&uTextureType<4.5)tex=.91+.06*sin(v*1100.*s)+.025*sin(v*2387.*s);
 else if(uTextureType>1.5&&uTextureType<2.5)tex=.97+.03*sin(v*450.*s);
 else if(uTextureType>8.5&&uTextureType<10.5)tex=.94+.055*sin(u*671.*s)*sin(v*517.*s);
 vec3 srgb=clamp(col*tex,0.,1.);
 return mix(srgb/12.92,pow((srgb+.055)/1.055,vec3(2.4)),step(vec3(.04045),srgb));
}
`;

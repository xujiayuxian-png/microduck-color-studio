import {COLORS as SPOOL_COLORS} from './state.mjs';
export {SPOOL_COLORS};
export const SECTIONS=[['head','头部'],['neck','颈部'],['body','躯干'],['left-leg','左腿与左脚'],['right-leg','右腿与右脚']];
export const STANDARD_COLORS=[
 ['纯白','#ffffff'],['象牙白','#fffff0'],['亚麻','#faf0e6'],['米色','#f5f5dc'],['浅灰','#d3d3d3'],['银灰','#c0c0c0'],['石板灰','#708090'],['炭灰','#2f4f4f'],['纯黑','#000000'],['海军蓝','#000080'],['宝蓝','#4169e1'],['钢蓝','#4682b4'],['天蓝','#87cefa'],['青色','#00ffff'],['绿松石','#40e0d0'],['水鸭绿','#008080'],['海绿','#2e8b57'],['森林绿','#228b22'],['青柠绿','#00ff00'],['橄榄绿','#808000'],['金黄','#ffd700'],['明黄','#ffff00'],['柠檬奶油','#fffacd'],['卡其','#f0e68c'],['橘色','#ff8c00'],['珊瑚','#ff7f50'],['番茄红','#ff6347'],['正红','#ff0000'],['砖红','#b22222'],['绯红','#dc143c'],['亮粉','#ff69b4'],['深粉','#ff1493'],['兰紫','#dda0dd'],['中紫','#9370db'],['靛蓝','#4b0082'],['巧克力','#d2691e'],['皮革棕','#a0522d'],['胡桃棕','#8b4513'],['沙棕','#deb887'],['淡褐','#d2b48c']
].map(([name,hex])=>({name,hex}));
export const MATERIALS={
 matte:{name:'哑光塑料',en:'MATTE',roughness:.76,metalness:0,clearcoat:0,preview:'linear-gradient(135deg,#d5d1c5,#9e9a8f)'},
 gloss:{name:'亮面烤漆',en:'GLOSS',roughness:.16,metalness:.02,clearcoat:1,preview:'radial-gradient(circle at 30% 22%,white 0,#efcab5 14%,#b97960 55%,#764b3d)'},
 silk:{name:'丝绸耗材',en:'SILK',roughness:.32,metalness:.38,clearcoat:.45,preview:'linear-gradient(115deg,#8b6d30,#f8e7a0 35%,#ad8639 53%,#f4dc81 75%,#876528)'},
 metal:{name:'抛光金属',en:'METAL',roughness:.13,metalness:1,clearcoat:.1,preview:'linear-gradient(150deg,#657079 3%,#f3f4f3 31%,#586570 48%,#d6dce0 68%,#7e8c96)'},
 brushed:{name:'拉丝金属',en:'BRUSHED',roughness:.4,metalness:.95,clearcoat:0,preview:'repeating-linear-gradient(0deg,#a6acb0 0px,#d6dbdc 1px,#a2aaaf 2px)'},
 pearl:{name:'珠光陶瓷',en:'PEARL',roughness:.24,metalness:.26,clearcoat:.9,preview:'radial-gradient(circle at 30% 20%,#fff,#e1dfed 35%,#e8cfcf 60%,#b5c9c0)'},
 wood:{name:'自然木纹',en:'WOOD',roughness:.72,metalness:0,clearcoat:.1,preview:'repeating-linear-gradient(10deg,#8f5f3c 0px,#c69b68 3px,#a77748 6px,#d4b181 8px)'},
 marble:{name:'大理石',en:'MARBLE',roughness:.24,metalness:.02,clearcoat:.7,preview:'repeating-linear-gradient(130deg,#e9e7e2 0,#f6f5f1 8px,#777c7c 9px,#f2f0eb 11px)'},
 carbon:{name:'碳纤维',en:'CARBON',roughness:.36,metalness:.4,clearcoat:.6,preview:'repeating-conic-gradient(#343d3e 0% 25%,#697270 0% 50%) 50% / 9px 9px'},
 clay:{name:'磨砂陶土',en:'CLAY',roughness:1,metalness:0,clearcoat:0,preview:'linear-gradient(120deg,#d6b59c,#99745c)'},
 frost:{name:'磨砂涂层',en:'FROST',roughness:.92,metalness:.02,clearcoat:0,preview:'radial-gradient(circle at 25% 20%,#e3ede2,#9bad9a)'},
 glass:{name:'彩色玻璃',en:'GLASS',roughness:.08,metalness:0,clearcoat:1,preview:'linear-gradient(135deg,#d9eee9aa 0,#faffff 26%,#90b6ada0 33%,#d5e9e4aa 62%,#fafdfb 75%,#8eb4a980)'}
};
export const PAINTS={solid:'纯色',linear:'双色渐变',radial:'径向渐变',tri:'三色渐变',rainbow:'彩虹渐变'};
const BASE={color:'#eeeee7',color2:'#79a389',color3:'#b5a4da',paint:'solid',material:'matte',angle:90,scale:1,roughness:.76,metalness:0,clearcoat:0};
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
export function normalizeHex(value,fallback='#eeeee7'){
 if(typeof value!=='string')return fallback;let s=value.trim().toLowerCase();if(!s.startsWith('#'))s='#'+s;
 if(/^#[0-9a-f]{3}$/.test(s))s='#'+[...s.slice(1)].map(c=>c+c).join('');return /^#[0-9a-f]{6}$/.test(s)?s:fallback;
}
export function sanitizeAppearance(input={},fallback=BASE){
 const x=input&&typeof input==='object'?input:{};const material=Object.hasOwn(MATERIALS,x.material)?x.material:fallback.material;const m=MATERIALS[material];
 return {color:normalizeHex(x.color,fallback.color),color2:normalizeHex(x.color2,fallback.color2),color3:normalizeHex(x.color3,fallback.color3),paint:Object.hasOwn(PAINTS,x.paint)?x.paint:fallback.paint,material,angle:((clamp(x.angle,-36000,36000,fallback.angle)%360)+360)%360,scale:clamp(x.scale,.25,6,fallback.scale),roughness:clamp(x.roughness,0,1,x.material?m.roughness:fallback.roughness),metalness:clamp(x.metalness,0,1,x.material?m.metalness:fallback.metalness),clearcoat:clamp(x.clearcoat,0,1,x.material?m.clearcoat:fallback.clearcoat)};
}
export function defaultConfig(parts){return Object.fromEntries(parts.map(p=>{
 let x={...BASE};if(p.legacyGroup==='eyes')x.color=SPOOL_COLORS.yellow.hex;if(p.legacyGroup==='feet')x.color=SPOOL_COLORS.green.hex;
 if(p.hardware){x.color=/bearing|speaker/.test(p.mesh||'')?'#89948e':'#303b38';x.material=/bearing/.test(p.mesh||'')?'metal':/lens/.test(p.mesh||'')?'gloss':'matte';Object.assign(x,MATERIALS[x.material]);delete x.name;delete x.en;delete x.preview;}
 return [p.id,sanitizeAppearance(x)];}));}
export function sanitizeConfig(input,parts){const defaults=defaultConfig(parts);return Object.fromEntries(parts.map(p=>[p.id,sanitizeAppearance(input?.[p.id],defaults[p.id])]));}
export function migrateConfig(value,parts){
 if(value?.config)return sanitizeConfig(value.config,parts);
 const legacy=value?.colors||value||{};const config=defaultConfig(parts);
 for(const p of parts){if(p.hardware)continue;const c=legacy[p.legacyGroup];if(SPOOL_COLORS[c])config[p.id].color=SPOOL_COLORS[c].hex;else if(typeof c==='string'&&/^#/.test(c))config[p.id].color=normalizeHex(c);}
 return config;
}
export function patchSelected(config,ids,patch,parts){const out={...config};const valid=new Set(parts.map(p=>p.id));for(const id of new Set(ids)){if(valid.has(id))out[id]=sanitizeAppearance({...config[id],...patch});}return out;}
export function cloneConfig(config){return Object.fromEntries(Object.entries(config).map(([id,a])=>[id,{...a}]))}
function newID(){return crypto.randomUUID()}
export function hydrateStudio(data,parts){
 const root=data&&typeof data==='object'?data:{};const known=new Set(parts.map(p=>p.id));const used=new Set();
 const goodID=value=>{let id=typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value)&&value!=='current'&&!used.has(value)?value:newID();used.add(id);return id;};
 const groups=Array.isArray(root.groups)?root.groups.filter(g=>g&&typeof g.name==='string'&&g.name.trim()&&Array.isArray(g.ids)).map(g=>({id:goodID(g.id),name:g.name.trim().slice(0,24),ids:[...new Set(g.ids.filter(id=>known.has(id)))]})).filter(g=>g.ids.length).slice(0,16):[];
 const saved=Array.isArray(root.saved)?root.saved.filter(s=>s&&typeof s.name==='string'&&s.name.trim()).slice(0,8).map(s=>({id:goodID(s.id),name:s.name.trim().slice(0,32),config:migrateConfig(s,parts),image:typeof s.image==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(s.image)?s.image:''})):[];
 return {version:2,config:migrateConfig(root,parts),groups,saved};
}
export function appearanceCSS(a){if(a.paint==='solid')return a.color;if(a.paint==='rainbow')return 'linear-gradient(90deg,#ff7272,#f5de61,#79bc91,#78bfe1,#a68bda)';const stops=a.paint==='tri'?`${a.color2},${a.color3},${a.color}`:`${a.color2},${a.color}`;return a.paint==='radial'?`radial-gradient(circle,${a.color},${a.color2})`:`linear-gradient(${90-a.angle}deg,${stops})`;}
export function styleLabel(a){return `${a.color.toUpperCase()}${a.paint==='solid'?'':` → ${a.color2.toUpperCase()}`} · ${MATERIALS[a.material].name}`;}
export function buildPresets(parts){
 const legacy=(name,tag,map)=>({name,tag,config:migrateConfig({colors:map},parts)});
 const list=[legacy('青柠小白','白绿黄',{body:'white',guards:'white',eyes:'yellow',hips:'white',feet:'green',soles:'white'}),legacy('林间漫步','自然色',{body:'white',guards:'green',eyes:'yellow',hips:'white',feet:'green',soles:'white'}),legacy('晴空来信','蓝白色',{body:'white',guards:'blue',eyes:'yellow',hips:'white',feet:'blue',soles:'white'}),legacy('复古赛车','红灰色',{body:'white',guards:'red',eyes:'gray',hips:'gray',feet:'red',soles:'gray'})];
 const custom=(name,tag,fn)=>{const config=defaultConfig(parts);for(const p of parts)if(!p.hardware)config[p.id]=sanitizeAppearance({...config[p.id],...fn(p)});return {name,tag,config}};
 list.push(custom('极光流彩','渐变 × 珠光',p=>p.section==='head'?{color:'#62ddba',color2:'#8154d4',color3:'#83bfed',paint:'tri',material:'pearl',angle:90,roughness:.24,metalness:.26,clearcoat:.9}:{color:p.legacyGroup==='feet'?'#7870ae':'#e9eee8'}));
 list.push(custom('桃雾渐层','双色渐变',p=>p.section==='head'||p.legacyGroup==='guards'?{color:'#ffb490',color2:'#b4b1e3',paint:'linear',angle:70,material:'silk',roughness:.32,metalness:.38}:{color:'#eee5df'}));
 list.push(custom('钛灰机械','拉丝金属',p=>({color:p.legacyGroup==='eyes'?'#ff8a3a':'#8999a7',material:p.legacyGroup==='eyes'?'gloss':'brushed',roughness:.36,metalness:.95})));
 list.push(custom('胡桃与奶油','木纹 × 哑光',p=>p.legacyGroup==='guards'||p.mesh==='top_head_shell'?{color:'#b28351',material:'wood',roughness:.72,metalness:0,scale:1.6}:{color:'#f2e8d7',material:'matte'}));
 list.push(custom('珍珠星云','径向渐变',p=>p.section==='head'?{color:'#f0dfec',color2:'#93b3d9',paint:'radial',material:'pearl',roughness:.24,metalness:.26,clearcoat:.9}:{color:'#e8e8ee',material:'gloss',roughness:.16,clearcoat:1}));
 list.push(custom('碳纤竞速','碳纤 × 亮面',p=>p.legacyGroup==='guards'?{color:'#303d47',material:'carbon',scale:1.5,roughness:.36,metalness:.4,clearcoat:.6}:{color:p.legacyGroup==='eyes'||p.legacyGroup==='feet'?'#ee5045':'#dce0db',material:'gloss',roughness:.16,clearcoat:1}));
 list.push(custom('云石雕塑','石纹 × 陶瓷',p=>({color:p.legacyGroup==='eyes'?'#bf9762':'#eeeee9',material:p.legacyGroup==='eyes'?'metal':'marble',roughness:.24,metalness:p.legacyGroup==='eyes'?1:.02,scale:1.2})));
 list.push(custom('彩虹漫游','自由色谱',p=>p.section==='head'||p.legacyGroup==='guards'?{paint:'rainbow',material:'gloss',angle:35,roughness:.16,clearcoat:1}:{color:'#edece5'}));

 const finishes=[
 ['珊瑚陶土','clay','#c66e4e','#ead8bc'],['冰川磨砂','frost','#518c9b','#edf4f6'],
 ['琥珀透明','glass','#ce8c21','#313638'],['红白搪瓷','gloss','#b91c2c','#f8f8f6'],
 ['香槟丝绸','silk','#bf9950','#34373a'],['深海珠光','pearl','#164c70','#ccdce2'],
 ['午夜钛金','metal','#7c8188','#e6ad46'],['白橡木作','wood','#bba179','#e8e4dc']
 ];
 for(const [name,material,color,accent] of finishes)list.push(custom(name,MATERIALS[material].name,p=>({
 color:p.legacyGroup==='eyes'||p.legacyGroup==='feet'?accent:color,
 material:p.legacyGroup==='eyes'||p.legacyGroup==='feet'?'matte':material,
 ...((p.legacyGroup==='eyes'||p.legacyGroup==='feet')?{roughness:.76,metalness:0,clearcoat:0}:((({roughness,metalness,clearcoat})=>({roughness,metalness,clearcoat}))(MATERIALS[material])))
 })));
 return list.map((p,i)=>({...p,id:`preset-${i}`,materials:[...new Set(parts.filter(part=>!part.hardware).map(part=>p.config[part.id].material))]}));
}
export function snapshotStudio(config,groups){return {config:cloneConfig(config),groups:groups.map(g=>({...g,ids:[...g.ids]}))};}
export function restoreStudioSnapshot(snapshot){return snapshotStudio(snapshot.config,snapshot.groups);}
export function importStudioDocument(data,parts,currentGroups=[]){
 if(!data||typeof data!=='object'||(!data.config&&!data.colors))throw Error('没有找到有效的零件外观数据');
 if(Object.hasOwn(data,'groups')&&!Array.isArray(data.groups))throw Error('零件组合数据格式不正确');
 const result=hydrateStudio(data,parts);
 return {config:result.config,groups:Array.isArray(data.groups)?result.groups:currentGroups.map(g=>({...g,ids:[...g.ids]}))};
}

export function filterPresets(presets,material="all"){return material==="all"?presets:presets.filter(p=>p.materials.includes(material));}

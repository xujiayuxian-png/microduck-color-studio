export const COLORS={white:{name:'白色',hex:'#eeeee7'},green:{name:'绿色',hex:'#79a389'},yellow:{name:'柠檬黄',hex:'#e9db58'},blue:{name:'蓝色',hex:'#5887ba'},red:{name:'红色',hex:'#ce6358'},gray:{name:'灰色',hex:'#88908f'}};
export const PARTS=[{id:'body',name:'主体',en:'BODY',note:'头壳、躯干结构与喙部'},{id:'guards',name:'护板',en:'GUARDS',note:'躯干侧板与腿部外护板'},{id:'eyes',name:'眼睛',en:'EYE RINGS',note:'眼睛装饰圈，不含镜头'},{id:'hips',name:'髋部连接件',en:'HIP JOINTS',note:'髋部支架及连接结构'},{id:'feet',name:'脚',en:'FEET',note:'双脚与踝部结构'},{id:'soles',name:'脚底板',en:'SOLES',note:'左右脚底板'}];
const combo=(body,guards,eyes,hips,feet,soles)=>({body,guards,eyes,hips,feet,soles});
export const PRESETS=[
{id:'sprout',name:'青柠小白',tag:'你的白绿黄',desc:'白色打底，绿意与柠檬黄轻轻点亮。',colors:combo('white','white','yellow','white','green','white')},
{id:'forest',name:'林间漫步',tag:'自然系',desc:'柔和绿色护板，搭配干净的白色主体。',colors:combo('white','green','yellow','white','green','white')},
{id:'ocean',name:'晴空来信',tag:'蓝白系',desc:'白色与晴空蓝，让一点黄留在眼睛里。',colors:combo('white','blue','yellow','white','blue','white')},
{id:'race',name:'复古赛车',tag:'红灰系',desc:'红色护板配灰色结构，利落又有精神。',colors:combo('white','red','gray','gray','red','gray')},
{id:'lemon',name:'柠檬汽水',tag:'明亮系',desc:'柠檬黄护板与脚，清新得刚刚好。',colors:combo('white','yellow','green','white','yellow','white')},
{id:'stone',name:'月面漫游',tag:'极简系',desc:'灰白之间的一点蓝，安静而耐看。',colors:combo('gray','white','blue','gray','white','gray')}
];
export function sanitize(input={}){return Object.fromEntries(PARTS.map(p=>[p.id,Object.hasOwn(COLORS,input?.[p.id])?input[p.id]:PRESETS[0].colors[p.id]]));}
export function changeColor(input,part,color){return Object.hasOwn(COLORS,color)&&PARTS.some(p=>p.id===part)?{...sanitize(input),[part]:color}:sanitize(input);}
export function wrapFrame(n){return ((n%24)+24)%24;}
export function hydrateSaved(value){
 if(!Array.isArray(value))return [];
 const seen=new Set();
 return value.filter(s=>s&&typeof s.name==='string'&&s.name.trim()).slice(0,4).map(s=>{
  const id=typeof s.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(s.id)&&s.id!=='current'&&!seen.has(s.id)?s.id:crypto.randomUUID();seen.add(id);
  return {id,name:s.name.trim().slice(0,24),colors:sanitize(s.colors),image:typeof s.image==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(s.image)?s.image:''};
 });
}

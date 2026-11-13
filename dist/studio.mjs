import {filterPresets,STANDARD_COLORS,SPOOL_COLORS,MATERIALS,PAINTS,SECTIONS,normalizeHex,sanitizeAppearance,defaultConfig,patchSelected,cloneConfig,hydrateStudio,appearanceCSS,styleLabel,buildPresets,snapshotStudio,restoreStudioSnapshot,importStudioDocument} from './studio-state.mjs';
import {createViewer} from './viewer-v2.mjs';
import {createFallbackViewer} from './fallback-v2.mjs';
const $=selector=>document.querySelector(selector);
const STORAGE='microduck-color-studio-v2';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let presetImages=new Map(),presetFilter='all';
let parts=[],partById={},config={},saved=[],groups=[],presets=[],viewer;
let selected=new Set(['p043']),palette='standard',activeColor='color',dialogPurpose='save',copied=null;
let undoStack=[],redoStack=[],editStart=null,currentPreset='preset-0',persistTimer,toastTimer,hue=100;
let openSections=new Set(SECTIONS.map(([id])=>id));
const interior=new Set(['p033','p034','p036','p037','p041','p044','p046','p053']);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}
function persist(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify({version:2,config,saved,groups}))}catch{toast('浏览器存储空间不足，请导出完整方案保留修改。')}},120)}
function firstAppearance(){return config[[...selected][0]]||sanitizeAppearance()}
function beginEdit(){if(!editStart)editStart=snapshotStudio(config,groups)}
function finishEdit(){if(editStart&&JSON.stringify(editStart)!==JSON.stringify(snapshotStudio(config,groups))){undoStack.push(editStart);if(undoStack.length>40)undoStack.shift();redoStack=[]}editStart=null;syncHistory();persist()}
function applyPatch(patch,live=false){if(!selected.size)return toast('请先选择至少一个零件');beginEdit();config=patchSelected(config,[...selected],patch,parts);currentPreset='';syncUI();if(!live)finishEdit();else persist()}
function replaceConfig(value,preset='',nextGroups){finishEdit();undoStack.push(snapshotStudio(config,groups));if(undoStack.length>40)undoStack.shift();redoStack=[];config=cloneConfig(value);if(nextGroups!==undefined){groups=nextGroups.map(g=>({...g,ids:[...g.ids]}));renderGroups()}currentPreset=preset;syncUI();persist()}
function syncHistory(){$('#undo-btn').disabled=!undoStack.length;$('#redo-btn').disabled=!redoStack.length}
function setSelection(ids,add=false){finishEdit();const valid=ids.filter(id=>partById[id]);selected=add?new Set([...selected,...valid]):new Set(valid);for(const id of selected)openSections.add(partById[id].section);renderTree();syncUI()}
function choosePart(id,options={}){if(!partById[id])return;if(options.additive||$('#multi-select').checked){const next=new Set(selected);next.has(id)?next.delete(id):next.add(id);setSelection([...next])}else setSelection([id]);}
function renderTree(){
 const query=$('#part-search').value.trim().toLowerCase(),hardware=$('#show-hardware').checked,top=$('#part-tree').scrollTop;
 const visible=parts.filter(p=>(hardware||!p.hardware)&&(!query||`${p.name} ${p.mesh}`.toLowerCase().includes(query)));
 $('#visible-total').textContent=query?`${visible.length} 个匹配`:(hardware?`${parts.length} 个装配件`:`${parts.filter(p=>!p.hardware).length} 个打印件`);
 $('#part-tree').innerHTML=SECTIONS.map(([section,name])=>{const rows=visible.filter(p=>p.section===section);if(!rows.length)return '';return `<details class="part-section" data-section="${section}" ${openSections.has(section)||query?'open':''}><summary><span>${name}</span><small>${rows.length}</small></summary>${rows.map(p=>`<div class="part-row ${selected.has(p.id)?'selected ':''}${p.hardware?'hardware':''}" data-part="${p.id}"><input type="checkbox" data-check="${p.id}" aria-label="多选 ${esc(p.name)}" ${selected.has(p.id)?'checked':''}><button data-select="${p.id}" aria-label="编辑 ${esc(p.name)}" title="${esc(p.mesh)}.stl${interior.has(p.id)?' · 内部零件':''}"><i class="part-chip" style="background:${appearanceCSS(config[p.id])}"></i><span class="part-name">${esc(p.name)}</span></button></div>`).join('')}</details>`}).join('')||'<div class="empty-message">没有找到这个零件。<br>可以试试名称或 STL 文件名。</div>';
 $('#part-tree').scrollTop=top;
 for(const detail of $('#part-tree').querySelectorAll('details'))detail.addEventListener('toggle',()=>detail.open?openSections.add(detail.dataset.section):openSections.delete(detail.dataset.section));
}
function renderGroups(){
 const printed=section=>parts.filter(p=>!p.hardware&&(!section||p.section===section)).map(p=>p.id);
 const quick=[['head','头部打印件',printed('head')],['neck','颈部打印件',printed('neck')],['body','躯干打印件',printed('body')],['feet','左右脚与脚底板',parts.filter(p=>p.legacyGroup==='feet'||p.legacyGroup==='soles').map(p=>p.id)],['printed','全部打印件',printed()],['all','全部装配件',parts.map(p=>p.id)]];
 $('#quick-group').innerHTML='<option value="">快捷选择 / 我的组合</option><optgroup label="快捷组合">'+quick.map(([id,name,ids])=>`<option value="${id}">${name} · ${ids.length} 件</option>`).join('')+'</optgroup>'+(groups.length?'<optgroup label="我的组合">'+groups.map(g=>`<option value="${g.id}">${esc(g.name)} · ${g.ids.length} 件</option>`).join('')+'</optgroup>':'');
 $('#quick-group').onchange=()=>{const id=$('#quick-group').value;const ids=quick.find(x=>x[0]===id)?.[2]||groups.find(g=>g.id===id)?.ids;if(ids){$('#part-search').value='';if(ids.some(id=>partById[id].hardware))$('#show-hardware').checked=true;setSelection(ids)}$('#quick-group').value=''};
 $('#group-manage').innerHTML=groups.length?`<button class="text-btn" id="manage-groups">管理 ${groups.length} 个组合</button>`:'';
 $('#manage-groups')?.addEventListener('click',showGroups);
}
function syncUI(){
 const ids=[...selected],a=firstAppearance(),main=partById[ids[0]];
 $('#selected-count').textContent=`已选 ${ids.length} 件`;$('#create-group').disabled=ids.length<2;$('#saved-count').textContent=saved.length;
 $('#inspector-title').textContent=ids.length>1?`${ids.length} 个零件`:main?.name||'选择一个零件';
 const mixed=ids.length>1&&ids.some(id=>JSON.stringify(config[id])!==JSON.stringify(a));
 $('#inspector-subtitle').textContent=!ids.length?'在零件列表或模型上选择':mixed?'外观不完全相同。修改只更新当前设置项。':ids.length>1?'设置会同时应用到选中的零件':interior.has(ids[0])?'内部零件在装配视图中可能被遮挡。':'仅编辑当前选中的真实零件';
 $('#part-label').textContent=ids.length>1?`已选 ${ids.length} 个零件`:main?.name||'尚未选择';$('#edit-fields').disabled=!ids.length;
 $('#appearance-dot').style.background=appearanceCSS(a);$('#current-material').textContent=MATERIALS[a.material].name;
 for(const row of $('#part-tree').querySelectorAll('[data-part]')){const id=row.dataset.part;row.classList.toggle('selected',selected.has(id));row.querySelector('input').checked=selected.has(id);row.querySelector('.part-chip').style.background=appearanceCSS(config[id])}
 for(const b of document.querySelectorAll('[data-paint]')){const active=b.dataset.paint===a.paint;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}
 if(a.paint==='solid')activeColor='color';if(a.paint!=='tri'&&activeColor==='color3')activeColor='color';
 const stops=a.paint==='solid'?[['color','颜色']]:a.paint==='tri'?[['color','颜色 A'],['color3','中间色'],['color2','颜色 B']]:[['color','颜色 A'],['color2','颜色 B']];
 $('#color-stops').innerHTML=stops.map(([key,name])=>`<button class="stop-button ${key===activeColor?'active':''}" data-stop="${key}" aria-label="编辑${name}" aria-pressed="${key===activeColor}"><i style="background:${a[key]}"></i>${name}</button>`).join('');
 $('#active-color-name').textContent=stops.find(x=>x[0]===activeColor)?.[1]||'颜色';
 if(document.activeElement!==$('#hex-input'))$('#hex-input').value=a[activeColor].slice(1);$('#native-color').value=a[activeColor];
 $('#gradient-controls').hidden=a.paint==='solid'||a.paint==='radial';$('#angle-slider').value=a.angle;$('#angle-output').textContent=`${Math.round(a.angle)}°`;
 for(const [id,key] of [['roughness','roughness'],['metalness','metalness'],['clearcoat','clearcoat'],['scale','scale']]){$(`#${id}-slider`).value=Math.round(a[key]*100);$(`#${id}-output`).textContent=id==='scale'?`${a.scale.toFixed(2)}×`:`${Math.round(a[key]*100)}%`}
 for(const b of document.querySelectorAll('[data-material]')){const active=b.dataset.material===a.material;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}
 for(const b of document.querySelectorAll('[data-swatch]'))b.classList.toggle('active',b.dataset.swatch===a[activeColor]);
 for(const b of document.querySelectorAll('[data-preset]'))b.classList.toggle('active',b.dataset.preset===currentPreset);
 syncPicker();syncHistory();viewer?.setConfig(config);viewer?.select(ids);
}
function renderPalette(){const list=palette==='spools'?Object.values(SPOOL_COLORS):STANDARD_COLORS;$('#standard-palette').innerHTML=list.map(c=>`<button class="color-swatch" data-swatch="${c.hex}" style="background:${c.hex}" aria-label="${c.name} ${c.hex}" title="${c.name} · ${c.hex.toUpperCase()}"></button>`).join('');$('#palette-note').textContent=palette==='spools'?'你的白、绿、柠檬黄、蓝、红、灰。仍可随时自由调色。':'标准色使用常见 CSS / sRGB 色值，可自由修改。';for(const b of document.querySelectorAll('[data-palette]'))b.classList.toggle('active',b.dataset.palette===palette);}
function rgbToHSV(hex){let [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=hue;if(d){h=(max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60;if(h<0)h+=360}return {h,s:max?d/max:0,v:max};}
function hsvToHex(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+[r,g,b].map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('')}
function syncPicker(){const hsv=rgbToHSV(firstAppearance()[activeColor]);hue=hsv.h;$('#hue-slider').value=Math.round(hue);$('#sv-picker').style.backgroundColor=`hsl(${hue} 100% 50%)`;$('#sv-cursor').style.left=`${hsv.s*100}%`;$('#sv-cursor').style.top=`${(1-hsv.v)*100}%`;$('#sv-picker').setAttribute('aria-valuenow',String(Math.round(hsv.s*100)));$('#sv-picker').setAttribute('aria-valuetext',`${firstAppearance()[activeColor]}，饱和度 ${Math.round(hsv.s*100)}%，明度 ${Math.round(hsv.v*100)}%`)}
function renderPresets(){
 const shown=filterPresets(presets,presetFilter);$('.presets-count').textContent=`${shown.length} / ${presets.length} 个灵感方案`;
 $('#presets').innerHTML=shown.map(p=>{const dots=[...new Set(parts.filter(x=>!x.hardware).map(x=>p.config[x.id].color))].slice(0,4);return `<button class="preset" data-preset="${p.id}" title="应用${p.name}完整方案"><div class="preset-image">${presetImages.has(p.id)?`<img src="${presetImages.get(p.id)}" alt="${esc(p.name)}配色与材质预览">`:`<div class="preset-placeholder" style="background:${appearanceCSS(p.config.p043)}"></div>`}<span class="preset-tag">${p.tag}</span></div><div class="preset-bottom"><span>${p.name}</span><span class="preset-colors">${dots.map(hex=>`<span style="background:${hex}"></span>`).join('')}</span></div></button>`}).join('');
}
function setupControls(){
 $('#preset-filter').insertAdjacentHTML('beforeend',Object.entries(MATERIALS).map(([id,m])=>`<option value="${id}">${m.name}</option>`).join(''));
 $('#preset-filter').onchange=()=>{presetFilter=$('#preset-filter').value;renderPresets();syncUI()};
 $('#reference-mode').onchange=()=>{const enabled=$('#reference-mode').checked;viewer?.setReference(enabled);$('#lighting-note').textContent=enabled?'原色核对 · 关闭光照与反射，保留颜色及纹理':'中性工作室光 · 无滤镜色调映射'};

 $('#paint-options').innerHTML=Object.entries(PAINTS).map(([id,name])=>`<button class="paint-option" data-paint="${id}" aria-pressed="false">${name}</button>`).join('');
 $('#material-options').innerHTML=Object.entries(MATERIALS).map(([id,m])=>`<button class="material-option" data-material="${id}" aria-pressed="false"><i class="material-orb" style="background:${m.preview}"></i><span>${m.name}</span></button>`).join('');
 $('#part-tree').addEventListener('click',e=>{const btn=e.target.closest('[data-select]');if(btn)choosePart(btn.dataset.select,{additive:e.ctrlKey||e.metaKey||e.shiftKey})});
 $('#part-tree').addEventListener('change',e=>{if(e.target.dataset.check){const next=new Set(selected);e.target.checked?next.add(e.target.dataset.check):next.delete(e.target.dataset.check);setSelection([...next])}});
 $('#part-search').addEventListener('input',renderTree);$('#show-hardware').addEventListener('change',renderTree);
 for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{for(const t of document.querySelectorAll('[data-tab]'))t.setAttribute('aria-selected',String(t===b));$('#color-panel').hidden=b.dataset.tab!=='color';$('#material-panel').hidden=b.dataset.tab!=='material'});
 $('#paint-options').addEventListener('click',e=>{const b=e.target.closest('[data-paint]');if(b)applyPatch({paint:b.dataset.paint})});
 $('#color-stops').addEventListener('click',e=>{const b=e.target.closest('[data-stop]');if(b){finishEdit();activeColor=b.dataset.stop;syncUI()}});
 $('#standard-palette').addEventListener('click',e=>{const b=e.target.closest('[data-swatch]');if(b)applyPatch({[activeColor]:b.dataset.swatch})});
 for(const b of document.querySelectorAll('[data-palette]'))b.addEventListener('click',()=>{palette=b.dataset.palette;renderPalette();syncUI()});
 $('#material-options').addEventListener('click',e=>{const b=e.target.closest('[data-material]');if(b){const {roughness,metalness,clearcoat}=MATERIALS[b.dataset.material];applyPatch({material:b.dataset.material,roughness,metalness,clearcoat})}});
 $('#hex-input').addEventListener('focus',beginEdit);$('#hex-input').addEventListener('input',()=>{const text=$('#hex-input').value.trim();if(/^#?[0-9a-f]{6}$/i.test(text))applyPatch({[activeColor]:normalizeHex(text)},true)});$('#hex-input').addEventListener('change',()=>{const text=$('#hex-input').value.trim();if(/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(text))applyPatch({[activeColor]:normalizeHex(text)},true);else toast('请输入 3 位或 6 位十六进制颜色');finishEdit();$('#hex-input').value=firstAppearance()[activeColor].slice(1)});$('#hex-input').addEventListener('keydown',e=>{if(e.key==='Enter')$('#hex-input').blur()});
 $('#native-color').addEventListener('input',()=>applyPatch({[activeColor]:$('#native-color').value},true));$('#native-color').addEventListener('change',finishEdit);
 $('#hue-slider').addEventListener('input',()=>{const hsv=rgbToHSV(firstAppearance()[activeColor]);hue=Number($('#hue-slider').value);applyPatch({[activeColor]:hsvToHex(hue,hsv.s||.6,hsv.v||.8)},true)});$('#hue-slider').addEventListener('change',finishEdit);
 for(const [id,key] of [['angle','angle'],['roughness','roughness'],['metalness','metalness'],['clearcoat','clearcoat'],['scale','scale']]){$(`#${id}-slider`).addEventListener('input',()=>applyPatch({[key]:Number($(`#${id}-slider`).value)/(id==='angle'?1:100)},true));$(`#${id}-slider`).addEventListener('change',finishEdit)}
 let picking=false;const pick=e=>{if(!selected.size)return;const r=$('#sv-picker').getBoundingClientRect();const s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),v=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));applyPatch({[activeColor]:hsvToHex(hue,s,v)},true)};
 $('#sv-picker').addEventListener('pointerdown',e=>{picking=true;beginEdit();$('#sv-picker').setPointerCapture(e.pointerId);pick(e)});$('#sv-picker').addEventListener('pointermove',e=>{if(picking)pick(e)});$('#sv-picker').addEventListener('pointerup',()=>{picking=false;finishEdit()});$('#sv-picker').addEventListener('pointercancel',()=>{picking=false;finishEdit()});
 $('#sv-picker').addEventListener('keydown',e=>{const hsv=rgbToHSV(firstAppearance()[activeColor]);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const s=Math.max(0,Math.min(1,hsv.s+(e.key==='ArrowRight'?.02:e.key==='ArrowLeft'?-.02:0))),v=Math.max(0,Math.min(1,hsv.v+(e.key==='ArrowUp'?.02:e.key==='ArrowDown'?-.02:0)));applyPatch({[activeColor]:hsvToHex(hue,s,v)})}});
 $('#copy-style').onclick=()=>{if(!selected.size)return toast('先选择一个零件');copied={...firstAppearance()};$('#paste-style').disabled=false;toast('已复制颜色、渐变与材质')};$('#paste-style').onclick=()=>{if(copied)applyPatch(copied)};
 $('#undo-btn').onclick=()=>{finishEdit();if(!undoStack.length)return;redoStack.push(snapshotStudio(config,groups));({config,groups}=restoreStudioSnapshot(undoStack.pop()));renderGroups();currentPreset='';syncUI();persist()};$('#redo-btn').onclick=()=>{if(!redoStack.length)return;undoStack.push(snapshotStudio(config,groups));({config,groups}=restoreStudioSnapshot(redoStack.pop()));renderGroups();currentPreset='';syncUI();persist()};
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input:not([type]),input[type=text],input[type=search],textarea')){e.preventDefault();$(e.shiftKey?'#redo-btn':'#undo-btn').click()}});
 $('#reset-all').onclick=()=>{replaceConfig(defaultConfig(parts),'preset-0');toast('已恢复初始方案，可撤销')};
 $('#presets').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');const p=presets.find(p=>p.id===b?.dataset.preset);if(p){replaceConfig(p.config,p.id);toast(`已应用「${p.name}」`)}});
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{viewer?.view(b.dataset.view);$('#auto-rotate').setAttribute('aria-pressed','false');for(const item of document.querySelectorAll('[data-view]'))item.classList.toggle('active',item===b)};
 $('#reset-view').onclick=()=>$('[data-view="hero"]').click();$('#auto-rotate').onclick=()=>{if(viewer)$('#auto-rotate').setAttribute('aria-pressed',String(viewer.rotate()))};
 for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>document.getElementById(b.dataset.close).close();
 for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 $('#create-group').onclick=()=>{if(selected.size<2)return;dialogPurpose='group';$('#name-title').textContent='把这些零件编为组合';$('#name-description').textContent=`组合会记住选中的 ${selected.size} 个零件，之后可一键选择并统一编辑。`;$('#name-input').value=`我的组合 ${groups.length+1}`;$('#name-dialog').showModal();$('#name-input').select()};
 $('#save-btn').onclick=()=>{if(!viewer)return toast('真实模型加载完成后即可收藏');if(saved.length>=8){showCompare();return toast('当前可收藏 8 个方案，请导出备份或删除一组后继续。')}dialogPurpose='save';$('#name-title').textContent='给这个方案起个名字';$('#name-description').textContent='收藏完整的零件配色、渐变与材质。';$('#name-input').value=presets.find(p=>p.id===currentPreset)?.name||`自由方案 ${saved.length+1}`;$('#name-dialog').showModal();$('#name-input').select()};
 $('#name-form').onsubmit=e=>{e.preventDefault();const name=$('#name-input').value.trim();if(!name){$('#name-input').setCustomValidity('请输入名称');$('#name-input').reportValidity();return}if(dialogPurpose==='group'){if(groups.length>=16)return toast('最多保留 16 个组合，可在组合管理中删除。');beginEdit();groups.push({id:crypto.randomUUID(),name:name.slice(0,24),ids:[...selected]});finishEdit();renderGroups();toast('已创建组合，之后仍可单独编辑每个零件')}else{saved.push({id:crypto.randomUUID(),name,config:cloneConfig(config),image:viewer.snapshot(config,500,430)});$('#saved-count').textContent=saved.length;toast('完整外观已收藏')}persist();$('#name-dialog').close()};$('#name-input').oninput=()=>$('#name-input').setCustomValidity('');
 $('#saved-btn').onclick=showCompare;$('#compare-btn').onclick=showCompare;
 $('#compare-grid').onclick=e=>{const restore=e.target.closest('[data-restore]'),del=e.target.closest('[data-delete]');if(restore){const s=saved.find(s=>s.id===restore.dataset.restore);if(s){replaceConfig(s.config);$('#compare-dialog').close();toast(`已应用「${s.name}」`)}}else if(del){saved=saved.filter(s=>s.id!==del.dataset.delete);persist();$('#saved-count').textContent=saved.length;showCompare()}};
 $('#export-btn').onclick=()=>$('#export-dialog').showModal();$('#export-png').onclick=exportPNG;$('#export-json').onclick=exportJSON;
 $('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=importJSON;
 $('#viewport').addEventListener('viewerror',()=>toast('这个视角暂时未能加载，请再试一次。'));
}
function showGroups(){
 $('#groups-list').innerHTML=groups.length?groups.map(g=>`<div class="group-list-row"><span>${esc(g.name)}<small>${g.ids.length} 件</small></span><div><button class="text-btn" data-use-group="${g.id}">选择</button><button class="text-btn" data-delete-group="${g.id}">删除</button></div></div>`).join(''):'<p>还没有自定义组合。多选两个零件后，即可创建。</p>';
 $('#groups-list').onclick=e=>{const use=e.target.closest('[data-use-group]'),del=e.target.closest('[data-delete-group]');if(use){const g=groups.find(g=>g.id===use.dataset.useGroup);if(g){if(g.ids.some(id=>partById[id].hardware))$('#show-hardware').checked=true;setSelection(g.ids);$('#groups-dialog').close()}}else if(del){beginEdit();groups=groups.filter(g=>g.id!==del.dataset.deleteGroup);finishEdit();renderGroups();persist();showGroups()}};
 if(!$('#groups-dialog').open)$('#groups-dialog').showModal();
}
function showCompare(){
 if(!viewer)return toast('模型正在加载，请稍等');finishEdit();
 const items=[{id:'current',name:'当前方案',config:cloneConfig(config),image:viewer.snapshot(config,500,430)},...saved];
 $('#compare-grid').innerHTML=items.map(s=>{const styled=parts.filter(p=>!p.hardware);const mats=new Set(styled.map(p=>s.config[p.id].material));const gradients=styled.filter(p=>s.config[p.id].paint!=='solid').length;return `<article class="saved-card"><img src="${viewer.snapshot(s.config,500,430)}" alt="${esc(s.name)}的完整外观预览"><div class="saved-card-body"><h3>${esc(s.name)}${s.id==='current'?'<span class="current-label">编辑中</span>':''}</h3><div class="saved-info">${mats.size} 种材质 · ${gradients} 个渐变零件</div><div class="saved-mapping">${styled.map(p=>`<div><span><i style="background:${appearanceCSS(s.config[p.id])}"></i>${esc(p.name)}</span><small>${MATERIALS[s.config[p.id].material].name}</small></div>`).join('')}</div>${s.id==='current'?'':`<div class="saved-card-actions"><button class="btn outline" data-restore="${s.id}">应用完整外观</button><button class="text-btn" data-delete="${s.id}">删除</button></div>`}</div></article>`}).join('');
 if(!saved.length)$('#compare-grid').insertAdjacentHTML('beforeend','<div class="empty-message">先收藏几种颜色与材质的组合，<br>再把它们放在一起比较。</div>');if(!$('#compare-dialog').open)$('#compare-dialog').showModal();
}
function download(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)}
function schemeName(){return presets.find(p=>p.id===currentPreset)?.name||'自由外观方案'}
function exportJSON(){finishEdit();const data={app:'MicroDuck Color & Material Lab',version:2,name:schemeName(),config:cloneConfig(config),groups:groups.map(g=>({...g,ids:[...g.ids]})),modelSource:'https://github.com/pollen-robotics/microduck_rl',parts:parts.map(p=>({id:p.id,name:p.name,mesh:p.mesh}))};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`MicroDuck-${schemeName()}.json`);$('#export-dialog').close();toast('完整方案已导出，可以随时重新导入')}
async function importJSON(e){const file=e.target.files?.[0];if(!file)return;try{if(file.size>3*1024*1024)throw Error('方案文件应小于 3 MB');const data=JSON.parse(await file.text());if(!data||(!data.config&&!data.colors))throw Error('没有找到有效的零件外观数据');const result=importStudioDocument(data,parts,groups);replaceConfig(result.config,'',result.groups);persist();toast('已导入完整方案，当前修改可撤销')}catch(error){toast(`导入失败：${error.message}`)}e.target.value=''}
async function exportPNG(){
 if(!viewer)return toast('模型加载完成后即可导出');finishEdit();const snapshot=cloneConfig(config),name=schemeName();
 const rows=parts.filter(p=>!p.hardware||JSON.stringify(snapshot[p.id])!==JSON.stringify(defaultConfig(parts)[p.id]));
 const width=1500,top=1070,rowHeight=64,height=top+Math.ceil(rows.length/2)*rowHeight+110;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');c.fillStyle='#f5f7ee';c.fillRect(0,0,width,height);c.fillStyle='#2c4934';c.font='bold 42px system-ui';c.fillText('micro duck / 自由配色与材质',70,80);c.font='22px system-ui';c.fillStyle='#819572';c.fillText(name,70,128);
 const image=new Image();image.src=viewer.snapshot(snapshot,1200,850);await image.decode();c.drawImage(image,150,145,1200,850);c.fillStyle='#59764a';c.font='22px system-ui';c.fillText('逐零件外观清单',70,1030);
 rows.forEach((p,i)=>{const x=70+(i%2)*720,y=top+Math.floor(i/2)*rowHeight,a=snapshot[p.id];let fill=a.color;if(a.paint!=='solid'){const g=c.createLinearGradient(x,y,x+29,y+29);g.addColorStop(0,a.color);if(a.paint==='tri')g.addColorStop(.5,a.color3);g.addColorStop(1,a.color2);fill=g}c.fillStyle=fill;c.fillRect(x,y-15,28,28);c.strokeStyle='#bccdb0';c.strokeRect(x,y-15,28,28);c.fillStyle='#36513c';c.font='19px system-ui';c.fillText(p.name,x+42,y+2);c.fillStyle='#8a9d7b';c.font='14px system-ui';c.fillText(styleLabel(a),x+42,y+25)});
 c.fillStyle='#99aa8a';c.font='16px system-ui';c.fillText('实际成品需结合耗材、打印与后处理。模型 © Pollen Robotics · CC BY-NC-SA 4.0 · 已转换与重新着色',70,height-40);
 canvas.toBlob(blob=>{if(!blob)return toast('图片导出失败，请重试');download(blob,`MicroDuck-${name}-外观清单.png`);$('#export-dialog').close();toast('配色与材质图已导出')},'image/png');
}
async function init(){try{
 const response=await fetch('./assets/parts.json?v=2');if(!response.ok)throw Error('零件目录加载失败');parts=await response.json();partById=Object.fromEntries(parts.map(p=>[p.id,p]));$('#part-total').textContent=parts.length;
 let data;try{data=JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem('microduck-color-studio-v1')||'null')}catch{}
 ({config,saved,groups}=hydrateStudio(data,parts));presets=buildPresets(parts);if(JSON.stringify(config)!==JSON.stringify(presets[0].config))currentPreset='';setupControls();renderPalette();renderGroups();renderTree();renderPresets();syncUI();
 const onSelect=(id,options={})=>{if(partById[id]?.hardware)$('#show-hardware').checked=true;$('#part-search').value='';choosePart(id,options)};
 try{viewer=await createViewer($('#viewport'),onSelect,parts)}catch(error){if(!/WebGL|context|DecompressionStream/i.test(String(error)))throw error;$('#viewport canvas')?.remove();viewer=await createFallbackViewer($('#viewport'),onSelect,parts)}
 syncUI();viewer.setReference($('#reference-mode').checked);$('#load-overlay')?.remove();document.body.dataset.ready='true';persist();
 if(viewer.mode==='multiview'){$('#view-mode').textContent='多视角预览';$('#render-note').textContent='兼容预览保留渐变与纹理；玻璃与金属反射为近似效果。'}
 for(const p of presets){try{const image=document.createElement('img');image.alt=`${p.name}配色与材质的真实模型`;image.src=viewer.snapshot(p.config,420,300);presetImages.set(p.id,image.src);$(`[data-preset="${p.id}"] .preset-placeholder`)?.replaceWith(image);await new Promise(r=>setTimeout(r,20))}catch{}}
 }catch(error){console.error(error);const overlay=$('#load-overlay');if(overlay){overlay.innerHTML='<strong>暂时未能装配模型</strong><span>请检查网络后重新加载。</span><button class="btn outline" id="retry-model">重新加载</button>';$('#retry-model').onclick=()=>location.reload()}else toast('部分预览未能加载，请刷新后重试。')}}
init();

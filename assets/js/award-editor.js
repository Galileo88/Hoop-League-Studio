(function(){
const trophies={championship:'Championship',natty:'National Championship',mvp:'MVP',fmvp:'Finals MVP',dpoy:'Defensive Player',roty:'Rookie', '6moty':'Sixth Man',mip:'Most Improved',poty:'Player of the Year',mop:'Most Outstanding',asmvp:'All-Star MVP',all_star:'All-Star',trophy:'Classic Trophy'};
const labels={name:'Award name',shortName:'Short name',enabled:'Award enabled',primaryC:'Primary color',secondaryC:'Secondary color',baseC:'Base color',plateC:'Plate color',HOFValue:'Hall of Fame value',minGames:'Minimum games played (%)',minMinutes:'Minimum minutes per game (%)',minStarted:'Minimum games started (%)',maxStarted:'Maximum games started (%)',MIN:'Minutes played',PM:'Plus / minus',POS:'Possessions',PTS:'Points',FGM:'Field goals made',FGA:'Field goals attempted',FGP:'Field goal percentage',TPM:'3-pointers made',TPA:'3-pointers attempted',TPP:'3-point percentage',FTM:'Free throws made',FTA:'Free throws attempted',FTP:'Free throw percentage',DRB:'Defensive rebounds',ORB:'Offensive rebounds',REB:'Total rebounds',AST:'Assists',STL:'Steals',BLK:'Blocks',TO:'Turnovers',PF:'Personal fouls',DD:'Double-doubles',TD:'Triple-doubles',POTG:'Player of the game',W:'Wins',L:'Losses',TimeWon:'Times won'};
// The extracted sprites encode the plate with red values 10 below the main gold.
// Keep these palettes separate so changing the plate never recolors the trophy body.
const trophyImages=new Map();

const trophyPalette={
 '237,172,55':['primaryC',0], '229,112,40':['primaryC',-.3], '231,223,107':['primaryC',.35],
 '163,172,190':['secondaryC',0], '103,112,139':['secondaryC',-.35], '219,224,231':['secondaryC',.6],
 '38,36,58':['baseC',0], '20,16,32':['baseC',-.45], '57,58,86':['baseC',.18],
 '227,172,55':['plateC',0], '221,223,107':['plateC',.35]
};
function awardColor(value,fallback){return /^#?[a-f0-9]{6}$/i.test(value||'')?String(value).replace('#',''):fallback}
function paintTrophy(source,award,resolve){
 const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height);
 const defaults={primaryC:'EDAC37',secondaryC:'A3ACBE',baseC:'26243A',plateC:'E3AC37'};
 for(let i=0;i<data.data.length;i+=4){if(!data.data[i+3])continue;const group=trophyPalette[Array.from(data.data.slice(i,i+3)).join(',')];if(!group)continue;
  const [key,shade]=group,hex=awardColor(resolve(award[key],key),defaults[key]);
  for(let c=0;c<3;c++){const base=parseInt(hex.slice(c*2,c*2+2),16);data.data[i+c]=Math.round(shade<0?base*(1+shade):base+(255-base)*shade)}
 }ctx.putImageData(data,0,0);return canvas.toDataURL();
}
window.renderAwardEditor=function(parent,award,path,{el,field,get,set,resolveColor,leagueType=0}){
 const root=el('div','award-editor');parent.append(root);const used=new Set(['id','nameC']);
 const tabs=el('div','award-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Award settings');root.append(tabs);
 const stage=el('div','award-stage');root.append(stage);const panels=[];const buttons=[];const selects=[];
 function activate(i){root.dataset.activeTab=['details','appearance','qualifications','weighting'][i];preview.hidden=i===3;buttons.forEach((b,n)=>{b.setAttribute('aria-selected',String(i===n));b.tabIndex=i===n?0:-1;panels[n].hidden=i!==n})}
 for(const [i,title] of ['Details','Appearance','Qualifications','Weighting'].entries()){
  const b=el('button','',title),p=el('section','award-panel');b.type='button';b.id='award-tab-'+path[1]+'-'+i;p.id=b.id+'-panel';b.setAttribute('role','tab');b.setAttribute('aria-controls',p.id);p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby',b.id);b.onclick=()=>activate(i);b.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%4;if(e.key==='ArrowLeft')n=(i+3)%4;if(e.key==='Home')n=0;if(e.key==='End')n=3;if(n!==undefined){e.preventDefault();activate(n);buttons[n].focus()}};buttons.push(b);panels.push(p);tabs.append(b);stage.append(p);
 }
 function grid(panel,title,help){if(title)panel.append(el('h3','',title));if(help)panel.append(el('p','note',help));const g=el('div','award-fields');panel.append(g);return g}
 function add(g,key,help){if(!Object.hasOwn(award,key))return;used.add(key);field(g,key,award[key],[...path,key]);const wrap=g.lastElementChild;if(!wrap)return;const title=labels[key]||key;wrap.firstElementChild.textContent=title;const input=wrap.querySelector('[data-path]');if(input)input.setAttribute('aria-label',title);for(const b of wrap.querySelectorAll('.number-control button'))b.setAttribute('aria-label',(b.textContent==='−'?'Decrease ':'Increase ')+title);if(input&&['minGames','minMinutes','minStarted','maxStarted'].includes(key)){input.min='0';input.max='100';const update=v=>{if(!Number.isFinite(v))return;set([...path,key],Math.max(0,Math.min(100,Math.round(v))));input.syncValue()};input.oninput=()=>{if(input.value!=='')update(Number(input.value))};const bs=wrap.querySelectorAll('button');bs[0].onclick=()=>update(get([...path,key])-1);bs[1].onclick=()=>update(get([...path,key])+1);} if(help)wrap.append(el('small','note',help));}
 function select(g,key,title,options){if(!Object.hasOwn(award,key))return;used.add(key);const w=el('label','field'),s=el('select');w.append(el('span','',title));const list=[...options];if(!list.some(([v])=>v===award[key]))list.push([award[key],'Imported value ('+award[key]+')']);for(const [value,text]of list){const o=el('option','',text);o.value=String(value);s.append(o)}selects.push({key,s});s.value=String(award[key]);s.dataset.path=JSON.stringify([...path,key]);s.setAttribute('aria-label',title);s.onchange=()=>set([...path,key],typeof award[key]==='number'?Number(s.value):s.value);w.append(s);g.append(w);return s}
 const preview=el('figure','award-preview'),img=el('img');img.width=img.height=128;img.alt='Original trophy artwork';const caption=el('figcaption','note','Live preview');let renderVersion=0;preview.append(img,caption);stage.prepend(preview);
 const identityHost=el('div','award-identity');panels[0].append(identityHost);const identity=grid(identityHost,'Award details');add(identity,'name');add(identity,'shortName');add(identity,'HOFValue');add(identity,'enabled');
 const collegeTrophies={natty:'National Championship',mop:'Most Outstanding Player',poty:'Player of the Year',dpoy:'Defensive Player of the Year',roty:'Freshman of the Year','6moty':'Sixth Man of the Year',mip:'Most Improved Player'};
 const designs=leagueType===1?[...Object.entries(collegeTrophies),...Object.entries(trophies).filter(([key])=>!Object.hasOwn(collegeTrophies,key)).map(([key,title])=>[key,['championship','fmvp','mvp'].includes(key)?title+' (Pro)':title])]:Object.entries(trophies);
 const design=el('div','award-design');preview.append(design);select(design,'spriteName','Trophy design',designs);
 preview.dataset.awardPreview='true';preview.syncAwardPreview=()=>{const current=get(path);for(const {key,s}of selects){if(![...s.options].some(o=>o.value===String(current[key]))){const o=el('option','','Imported value ('+current[key]+')');o.value=String(current[key]);s.append(o)}s.value=String(current[key]);for(const input of root.querySelectorAll('input[data-path]'))if(JSON.parse(input.dataset.path).at(-1)===key&&input.syncValue)input.syncValue()}const known=Object.hasOwn(trophies,current.spriteName);img.hidden=!known;const version=++renderVersion;caption.textContent=known?(current.name||'Live preview'):'No preview for this imported trophy';
 if(known){const sprite=current.spriteName;if(!trophyImages.has(sprite)){const source=new Image();const promise=new Promise((resolve,reject)=>{source.onload=()=>resolve(source);source.onerror=reject});source.src='assets/images/trophies/'+sprite+'.png';trophyImages.set(sprite,promise)}
 trophyImages.get(sprite).then(source=>{if(version!==renderVersion||!root.isConnected)return;const url=paintTrophy(source,get(path),(value,key)=>resolveColor&&value?resolveColor(value,[...path,key]):value);img.src=url;img.dataset.sprite=sprite;img.alt='Trophy with selected colors';}).catch(()=>{if(version===renderVersion){img.hidden=true;caption.textContent='Trophy preview unavailable'}});
 }const summary=parent.querySelector(':scope > summary');if(summary)summary.textContent=current.name||'Unnamed award'};preview.syncAwardPreview();
 const colorHost=el('div','award-colors');panels[1].append(colorHost);const colors=grid(colorHost,'Colors');for(const k of ['primaryC','secondaryC','baseC','plateC']){add(colors,k);const w=colors.lastElementChild;const picker=[...w.querySelectorAll('button')].find(b=>b.textContent==='Pick from team logo');picker?.remove();w.querySelector('.color-line select')?.remove();}
 const eligibility=grid(panels[2],'Who can win?');for(const [key,title]of [['pg','Point guard'],['sg','Shooting guard'],['sf','Small forward'],['pf','Power forward'],['c','Center'],['team','Team']]){labels[key]=title;add(eligibility,key)}
 eligibility.classList.add('award-positions');const rules=grid(panels[2],'Evaluation');select(rules,'phase','Season phase',[[0,'Regular season'],[3,'Finals']]);select(rules,'calculation','Calculation',[[0,'Average'],[1,'Total'],[2,'Improvement']]);select(rules,'yearsPro','Experience',[[0,'Any experience'],[1,leagueType===1?'Freshman':'Rookie']]);
 const limits=grid(panels[2],'Participation requirements');for(const k of ['minGames','minMinutes','minStarted','maxStarted'])add(limits,k);
 const main=grid(panels[3],'Stat weights','Positive weights reward a stat; negative weights penalize it. Zero means it does not contribute.');for(const k of ['PTS','AST','STL','BLK','FGM','FGA','FGP','TPM','TPA','TPP','FTM','FTA','FTP','ORB','DRB','REB'])add(main,k);
 main.classList.add('award-weights');for(const k of ['MIN','PM','POS','TO','PF','DD','TD','POTG','W','L','TimeWon'])add(main,k);
 const other=Object.keys(award).filter(k=>!used.has(k));if(other.length){const extra=el('details');extra.append(el('summary','','Additional imported settings'));root.append(extra);const g=grid(extra);for(const k of other)add(g,k)}
 for(const g of [identity,colors])for(const w of g.children){const control=w.querySelector('[data-path]');if(control)w.dataset.awardField=JSON.parse(control.dataset.path).at(-1)}const footer=el('div','award-footer');const remove=parent.querySelector(':scope > button');if(remove){remove.classList.add('award-remove');footer.append(remove)}root.append(footer);preview.syncAwardPreview();activate(0);
};
})();

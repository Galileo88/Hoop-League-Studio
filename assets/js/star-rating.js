/* Hoop Land 1.09.75 league-editor ratings. */
(()=>{
 const keys=['LAY','DNK','INS','MID','TPT','FTS','DRB','PAS','ORE','DRE','STL','BLK'];
 const f=Math.fround,clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const value=(p,key,index)=>p?.attributes?.[key]?.[index];
 const valid=(p,index)=>keys.every(key=>Number.isInteger(value(p,key,index))&&value(p,key,index)>=0&&value(p,key,index)<=20);
 function player(p,index=0){
  if(!valid(p,index))return null;
  const total=keys.reduce((n,key)=>n+value(p,key,index),0);
  return f(clamp(f(f(clamp(total,0,168)-28)/140),.1,1)*5);
 }

 // .NET's small-list sort preserves the native hybrid-position comparisons,
 // which inspect the list's current first two entries while it is sorted.
 function lineupSort(a,compare){
  const swap=(i,j)=>{if(compare(a[i],a[j])>0)[a[i],a[j]]=[a[j],a[i]]};
  if(a.length===2)swap(0,1);
  else if(a.length===3){swap(0,1);swap(0,2);swap(1,2)}
  else for(let i=0;i<a.length-1;i++){const value=a[i+1];let j=i;while(j>=0&&compare(value,a[j])<0){a[j+1]=a[j];j--}a[j+1]=value}
  return a;
 }
 const fits=(p,slot)=>slot>4||Math.abs(p.pos-slot*2)<=1;
 function prepareLineup(t,force=false,usePotential=true){
  if(!Array.isArray(t?.roster)||t.roster.length<5)return t;
  const roster=t.roster.map(p=>({...p}));lineupSort(roster,(a,b)=>a.linePos-b.linePos);
  const seen=new Set();const repair=roster.some((p,i)=>{const duplicate=seen.has(p.linePos);seen.add(p.linePos);return !Number.isInteger(p.linePos)||p.linePos<0||duplicate||(i<5&&p.linePos!==i)});
  if(!repair&&!force)return {...t,roster};
  // Only custom-league exhibition data is supported by this preparation path.
  if(roster.length>15||roster.some(p=>!valid(p,0)||!Number.isInteger(p.pos)||p.pos<0||p.pos>8||(usePotential&&!Number.isFinite(p.pot))||!Number.isFinite(p.ht)))return t;
  // Saved lineup order is an output, not a tie-breaker for the next rebuild.
  // Start current-overall depth charts from stable player IDs so equal ratings
  // and hybrid-position assignment cannot feed the previous result back in.
  // Keep the native exhibition repair path's original ordering unchanged.
  if(!usePotential)lineupSort(roster,(a,b)=>Number(a.id)-Number(b.id));
  for(const p of roster){const current=player(p);p.rating=usePotential?f(f(f(current*2)*1.5)+f(p.pot*2)):current;p.linePos=-1}
  const byRating=(a,b)=>b.rating-a.rating;
  const ranked=lineupSort([...roster],byRating),groups=Array.from({length:5},()=>[]),hybrids=Array.from({length:4},()=>[]);
  for(const p of ranked.slice(0,5)){if(p.pos%2)hybrids[(p.pos-1)/2].push(p);else groups[p.pos/2].push(p)}
  for(let slot=0;slot<4;slot++){
   const mixed=hybrids[slot];
   while(mixed.length){lineupSort(mixed,(a,b)=>mixed.indexOf(a)<2&&mixed.indexOf(b)<2?(slot===0?value(b,'PAS',0)-value(a,'PAS',0):b.ht-a.ht):mixed.indexOf(a)-mixed.indexOf(b));const p=mixed.shift();groups[groups[slot].length<=groups[slot+1].length?slot:slot+1].push(p)}
  }
  for(const p of ranked.slice(5)){
   if(p.pos%2===0){groups[p.pos/2].push(p);continue}
   const slot=(p.pos-1)/2,left=groups[slot],right=groups[slot+1];let chooseLeft=left.length<right.length;
   if(left.length===right.length){const a=k=>value(p,k,0);chooseLeft=slot===0?a('PAS')>(a('MID')+a('TPT'))/2:slot===3?a('INS')+a('MID')>a('ORE')+a('DRE'):a('MID')+a('TPT')>a('ORE')+a('DRE')}
   (chooseLeft?left:right).push(p);
  }
  groups.forEach((group,slot)=>group.forEach((p,i)=>{p.teamPos=slot*2;p.posRnk=i}));
  lineupSort(roster,(a,b)=>a.posRnk-b.posRnk||byRating(a,b));
  const starters=[],slots=Array(5).fill(null);
  for(const p of roster){const slot=p.teamPos/2;if(!slots[slot]){p.linePos=slot;slots[slot]=p;starters.push(p)}}
  const fill=slot=>{const p=roster.find(p=>p.linePos<0&&fits(p,slot));if(p){p.linePos=slot;slots[slot]=p;starters.push(p);lineupSort(starters,(a,b)=>a.linePos-b.linePos)}};
  const shift=(slot,direction)=>{lineupSort(starters,(a,b)=>direction>0?a.linePos-b.linePos:b.linePos-a.linePos);const p=starters.find(p=>direction>0?p.linePos>slot:p.linePos<slot);if(p){const old=p.linePos;slots[old]=null;p.linePos=slot;slots[slot]=p;fill(old)}else fill(0)};
  if(starters.length<5)for(let slot=0;slot<5;slot++)if(!slots[slot])shift(slot,slot<4?1:-1);
  if(starters.length<5)for(let slot=4;slot>=0;slot--)if(!slots[slot])shift(slot,-1);
  lineupSort(starters,(a,b)=>a.linePos-b.linePos);
  const ordered=[...starters,...roster.filter(p=>p.linePos<0)];ordered.forEach((p,i)=>p.linePos=i);
  for(const a of roster)if(a.linePos<5)for(const b of roster)if(b!==a&&b.rating>a.rating&&b.linePos>4&&fits(b,a.linePos)&&fits(a,b.linePos))[a.linePos,b.linePos]=[b.linePos,a.linePos];
  lineupSort(roster,(a,b)=>a.linePos>4&&a.linePos<12&&b.linePos>4&&b.linePos<12?byRating(a,b):a.linePos-b.linePos);
  roster.forEach((p,i)=>p.linePos=i);
  return {...t,roster};
 }
 const prepareTeam=(t,force=false)=>prepareLineup(t,force,true);
 const prepareDepthChart=(t,force=false)=>prepareLineup(t,force,false);

 function rebuildLineups(data,force=false){
  let changed=0;
  for(const t of [...(data?.teams||[]),...(data?.starTeams||[])]){
   const prepared=prepareDepthChart(t,true);if(prepared===t)continue;
   const before=JSON.stringify([t.roster,t.startingLineup]);
   const previous=new Map((t.startingLineup||[]).map(slot=>[slot.pid,slot]));
   t.roster=prepared.roster.map(p=>({...p,rating:0}));
   t.startingLineup=t.roster.map(p=>({...previous.get(p.id),linePos:p.linePos,pid:p.id,minutes:[...(p.minutes||previous.get(p.id)?.minutes||[0,0])]}));
   if(JSON.stringify([t.roster,t.startingLineup])!==before)changed++;
  }
  return changed;
 }
 function component(p,index,weights){
  let total=0;
  for(const [key,weight]of weights)total=f(total+f(f(value(p,key,index)/20)*weight));
  return f(total/6);
 }
 const offense=[['LAY',.5],['DNK',1.5],['INS',1],['MID',1],['TPT',2],['FTS',.5],['DRB',1.5],['PAS',1],['ORE',1]];
 const defense=[['DRE',3],['STL',3],['BLK',4]];
 function teamDetails(t,index=0){
  const roster=t?.roster;
  if(!Array.isArray(roster))return null;
  if(roster.length<5)return {offense:0,defense:0,overall:0};
  let off=0,def=0,weightSum=0;
  for(const p of roster){
   if(!Number.isInteger(p.linePos))return null;
   const weight=p.linePos<5?66:p.linePos<10?33:0;
   if(!weight)continue;
   if(!valid(p,index))return null;
   off=f(off+f(component(p,index,offense)*weight));
   def=f(def+f(component(p,index,defense)*weight));
   weightSum=f(weightSum+weight);
  }
  if(!weightSum)return null;
  off=f(off/weightSum);def=f(def/weightSum);
  return {offense:off,defense:def,overall:f(f(f(off*3)+def)*.25)};
 }
 const stars=rating=>Number.isFinite(rating)?f(clamp(rating,0,1)*5):null;
 const exhibitionDetails=(t,index=0)=>teamDetails(prepareTeam(t),index);
 const team=(t,index=0)=>stars(exhibitionDetails(t,index)?.overall);
 function rankings(teams,t){
  if(!teams.includes(t))return null;
  const entries=teams.map((team,index)=>({team,index,ratings:exhibitionDetails(team)}));
  if(entries.some(entry=>!entry.ratings))return null;
  return Object.fromEntries(['offense','defense','overall'].map(key=>{
   const sorted=[...entries].sort((a,b)=>b.ratings[key]-a.ratings[key]||a.index-b.index);
   return [key,sorted.findIndex(entry=>entry.team===t)+1];
  }));
 }
 const ordinal=n=>n+((n%100>=11&&n%100<=13)?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
 function createTeamSummary(t,getTeams){
  const root=document.createElement('div');root.className='team-ratings';root.dataset.starRating='true';
  const fields=['offense','defense','overall'].map(key=>{
   const card=document.createElement('div');card.className='team-rating-card';
   const label=document.createElement('strong');label.textContent=key[0].toUpperCase()+key.slice(1);
   const rating=create(()=>stars(exhibitionDetails(t)?.[key]),label.textContent+' rating');
   const rank=document.createElement('span');rank.className='team-rating-rank';card.append(label,rating,rank);root.append(card);
   return {key,rating,rank};
  });
  root.syncRating=()=>{const teams=getTeams(),ranks=rankings(teams,t);for(const field of fields){field.rating.syncRating();field.rank.textContent=ranks?ordinal(ranks[field.key]):'—';field.rank.title=ranks?`${ordinal(ranks[field.key])} of ${teams.length} league teams · Prepared league lineups`:teams.includes(t)?'Rank unavailable':'Not league-ranked'}};
  root.syncRating();return root;
 }
 function create(getRating,label='Rating',getMaximum=()=>5){
  const root=document.createElement('span');root.className='star-rating';root.dataset.starRating='true';root.setAttribute('role','img');
  const track=document.createElement('span');track.className='star-rating-track';track.textContent='★★★★★';track.setAttribute('aria-hidden','true');
  const fill=document.createElement('span');fill.className='star-rating-fill';fill.textContent='★★★★★';track.append(fill);root.append(track);
  root.syncRating=()=>{const rating=getRating(),maximum=getMaximum(),known=Number.isFinite(rating)&&Number.isFinite(maximum),cap=known?clamp(maximum,0,5):5,count=Math.ceil(cap);root.hidden=!known;track.firstChild.nodeValue=fill.textContent='★'.repeat(count);track.style.clipPath=`inset(0 ${count?(1-cap/count)*100:0}% 0 0)`;fill.style.width=(known&&count?clamp(rating,0,cap)/count*100:0)+'%';const text=`${label}: ${known?Number(Math.min(rating,cap).toFixed(2))+' out of '+cap:'unavailable'}`;root.setAttribute('aria-label',text);root.title=text+(label==='Team rating'?' · Exhibition lineup':'')};
  root.syncRating();return root;
 }
 const api={player,team,teamDetails,rankings,create,createTeamSummary,prepareTeam,prepareDepthChart,exhibitionDetails,rebuildLineups};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof window!=='undefined')window.HLSRatings=api;
})();

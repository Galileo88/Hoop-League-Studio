(()=>{
 const positionNames=['PG','G','SG','GF','SF','F','PF','FC','C'];
 const archetypes=['All-Around','Athletic Finisher','Interior Defender','Perimeter Defender','Playmaker','Post Scorer','Rebounder','Sharpshooter','Shot Creator','Slasher'];
 const skillIds=['BAL','BUL','CHE','CLA','CLE','CLU','CRA','DIM','DUN','FOO','HIG','HOT','LIM','LOC','MAG','SNA','SOF','SPA','SPO','STE','TEA','TWO','UNF','VOL'];
 const skillNames={BAL:'Ball Hawk',BUL:'Bully',CHE:'Chef',CLA:'Clamps',CLE:'Cleanup Crew',CLU:'Clutch Gene',CRA:'Crafty',DIM:'Dimer',DUN:'Dunk Artist',FOO:'Foot Surgeon',HIG:'Highlight Reel',HOT:'Hot Potato',LIM:'Limitless',LOC:'Locked In',MAG:'Magnet',SNA:'Snatcher',SOF:'Soft Touch',SPA:'Spark Plug',SPO:'Spot Up',STE:'Step Dancer',TEA:'Tear Dropper',TWO:'Two Way',UNF:'Unfazed',VOL:'Volume Shooter'};
 const skillDescriptions={
  BAL:'Improves the chance of catching a deflected pass.',BUL:'Makes defenders more likely to fall when you back them down.',
  CHE:'Can set you on fire when a teammate catches fire after your assist.',CLA:'Strengthens your shot contests.',
  CLE:'Improves shot accuracy after an offensive rebound.',CLU:'Improves shot accuracy in clutch situations.',
  CRA:'Improves reverse and contact layups.',DIM:'Improves a teammate’s shot accuracy after your pass.',
  DUN:'Improves dunk success and allows acrobatic dunks.',FOO:'Keeps an opponent down longer after an ankle breaker.',
  HIG:'Reduces stamina used for dunks.',HOT:'Keeps the ball hot after a pass while you are on fire.',
  LIM:'Improves accuracy on shots from beyond 25 feet.',LOC:'Boosts defensive attributes in clutch situations.',
  MAG:'Helps win contested rebounds by tipping the ball.',SNA:'Improves the chance of catching a blocked shot.',
  SOF:'Improves hook shot accuracy.',SPA:'Starts you hot when you come off the bench.',
  SPO:'Improves jump shot accuracy after receiving a pass.',STE:'Improves shot accuracy after a step-back or side-step.',
  TEA:'Improves floater accuracy.',TWO:'Can steal an opponent’s on-fire status with a steal or block.',
  UNF:'Improves contested midrange shot accuracy.',VOL:'Reduces stamina used for jump shots.'
 };
 const attributeNames={LAY:'Layup',DNK:'Dunk',INS:'Inside',MID:'Midrange',TPT:'Three-point',FTS:'Free throw',DRB:'Dribbling',PAS:'Passing',ORE:'Offensive rebounding',DRE:'Defensive rebounding',STL:'Steal',BLK:'Block',STR:'Strength',SPD:'Speed',STM:'Stamina'};
 function node(tag,className='',label){const item=document.createElement(tag);if(className)item.className=className;if(label!==undefined)item.textContent=label;return item}
 function name(player){return [player.fn,player.ln].filter(Boolean).join(' ')||'Player '+player.id}
 function row(parent,title,control,hint){const label=node('label','roster-field');label.append(node('span','',title),control);if(hint)label.append(node('small','',hint));parent.append(label);return label}
 function input(parent,title,value,change,{type='text',min,max,step}={}){
  const control=node('input');control.type=type;control.value=value??'';if(min!==undefined)control.min=String(min);if(max!==undefined)control.max=String(max);if(step!==undefined)control.step=String(step);
  control.setAttribute('aria-label',title);
  const syncStepper=()=>{if(type!=='number'||!control.value)return;const current=Number(control.value);if(!Number.isFinite(current))return;const wrap=control.parentElement;if(!wrap?.classList.contains('number-control'))return;const [minus,,plus]=wrap.children;minus.disabled=min!==undefined&&current<=Number(min);plus.disabled=max!==undefined&&current>=Number(max)};
  control.onchange=()=>{const next=type==='number'?Number(control.value):control.value;if(type==='number'&&(!control.value||!Number.isFinite(next)||!control.checkValidity())){control.setCustomValidity('Enter a valid number.');control.reportValidity();return}control.setCustomValidity('');change(next);syncStepper()};
  if(type==='number'){
   const wrap=node('div','number-control'),minus=node('button','','−'),plus=node('button','','+');
   minus.type=plus.type='button';minus.setAttribute('aria-label','Decrease '+title);plus.setAttribute('aria-label','Increase '+title);
   const stepBy=direction=>{if(direction<0)control.stepDown();else control.stepUp();control.dispatchEvent(new Event('change',{bubbles:true}))};
   minus.onclick=()=>stepBy(-1);plus.onclick=()=>stepBy(1);control.oninput=syncStepper;
   wrap.append(minus,control,plus);row(parent,title,wrap);syncStepper();return control
  }
  row(parent,title,control);return control;
 }
 function select(parent,title,value,options,change){const control=node('select');control.setAttribute('aria-label',title);
  for(const [id,label]of options){const option=node('option','',label);option.value=String(id);control.append(option)}
  if(!options.some(([id])=>String(id)===String(value))){const option=node('option','',`Imported value ${value}`);option.value=String(value);control.append(option)}
  control.value=String(value);control.onchange=()=>change(control.value);row(parent,title,control);return control;
 }
 function optionStepper(parent,title,value,options,change){
  const wrap=node('div','number-control option-control'),previous=node('button','','◀'),next=node('button','','▶'),control=node('select');
  control.setAttribute('aria-label',title);previous.type=next.type='button';previous.setAttribute('aria-label','Previous '+title);next.setAttribute('aria-label','Next '+title);
  for(const [id,label]of options){const option=node('option','',label);option.value=String(id);control.append(option)}
  if(!options.some(([id])=>String(id)===String(value))){const option=node('option','',`Imported value ${value}`);option.value=String(value);control.append(option)}
  control.value=String(value);
  const sync=()=>{previous.disabled=control.selectedIndex<=0;next.disabled=control.selectedIndex<0||control.selectedIndex>=control.options.length-1};
  const commit=()=>{sync();change(control.value)};
  previous.onclick=()=>{if(control.selectedIndex>0){control.selectedIndex--;commit()}};
  next.onclick=()=>{if(control.selectedIndex>=0&&control.selectedIndex<control.options.length-1){control.selectedIndex++;commit()}};
  control.onchange=commit;wrap.append(previous,control,next);row(parent,title,wrap);sync();return control;
 }
 function colorInput(parent,title,value,change,team,skinColor){
  const wrap=node('div','roster-field roster-color-field'),line=node('div','color-line'),swatch=node('input'),code=node('input'),reference=node('select');
  wrap.append(node('span','',title),line);swatch.type='color';code.type='text';code.maxLength=7;
  swatch.setAttribute('aria-label',title+' custom color');code.setAttribute('aria-label',title+' value');reference.setAttribute('aria-label',title+' team color');
  for(const [id,label]of [['','Custom'],['PRI','Primary'],['SEC','Secondary'],['TER','Tertiary']]){const option=node('option','',label);option.value=id;reference.append(option)}
  if(skinColor){const option=node('option','','None');option.value='none';reference.append(option)}
  const resolved=stored=>{const index={PRI:0,SEC:1,TER:2}[String(stored||'').toUpperCase()],chosen=index===undefined?stored:team?.teamColors?.[index];return /^#?[\da-f]{6}$/i.test(String(chosen||''))?'#'+String(chosen).replace('#',''):'#ffffff'};
  const skinHex=()=>String(skinColor?.()||'DC8158').replace(/^#/,'').toUpperCase();
  const sync=stored=>{swatch.value=resolved(stored);code.value=String(stored??'');reference.value=['PRI','SEC','TER'].includes(stored)?stored:skinColor&&String(stored||'').replace(/^#/,'').toUpperCase()===skinHex()?'none':''};
  const commit=stored=>{change(stored);sync(stored)};
  swatch.oninput=()=>commit(swatch.value.slice(1).toUpperCase());
  reference.onchange=()=>commit(reference.value==='none'?skinHex():reference.value||swatch.value.slice(1).toUpperCase());
  code.onchange=()=>{const next=code.value.trim().replace(/^#/,'').toUpperCase();if(next&&!/^(?:[\da-f]{6}|PRI|SEC|TER)$/.test(next)){code.setCustomValidity('Use a six-digit color or a team color.');code.reportValidity();return}code.setCustomValidity('');commit(next)};
  line.append(swatch,code,reference);parent.append(wrap);sync(value)
 }
 function appearanceFields(fields,hairFields,appearance,update){
     for(const [key,title]of [['skinC','Skin'],['eyeC','Eyes'],['browC','Eyebrows'],['hairC','Hair color'],['fHairC','Facial hair color']])if(key in appearance){
      const control=node('input');control.type='color';control.value='#'+String(appearance[key]||'262539').replace('#','');control.className='roster-appearance-color';
      const palette=key==='skinC'?['F6DFC6','EAC39D','D5A779','BE8A60','A66D45','855337','623C29','40271D']:key==='eyeC'?['151515','3B2417','654321','967443','6B7545','47734B','477FA3','829BA8','777777']:['151515','382820','65432D','916544','B68B55','D9BD79','A24D32','D0D0D0'];
      const wrap=node('div','roster-color-stepper'),previous=node('button','','◀'),next=node('button','','▶');previous.type=next.type='button';previous.setAttribute('aria-label','Previous '+title+' color');next.setAttribute('aria-label','Next '+title+' color');
      const cycle=direction=>{const current=palette.indexOf(control.value.slice(1).toUpperCase()),index=current<0?(direction>0?0:palette.length-1):(current+direction+palette.length)%palette.length;control.value='#'+palette[index];update(key,palette[index])};previous.onclick=()=>cycle(-1);next.onclick=()=>cycle(1);
      control.setAttribute('aria-label',title);control.oninput=()=>update(key,control.value.slice(1).toUpperCase());wrap.append(previous,control,next);row(['hairC','fHairC'].includes(key)?hairFields:fields,title,wrap).classList.add('roster-color-field')
     }
     if('unibrow'in appearance){const label=node('label','roster-check roster-unibrow-field'),check=node('input');check.type='checkbox';check.checked=!!appearance.unibrow;check.onchange=()=>update('unibrow',check.checked);label.append(check,' Unibrow');fields.append(label)}
     for(const [key,title,max,empty]of [['hair','Hair style',170,'Bald'],['fHair','Facial hair',31,'None']])if(key in appearance){
      const options=Array.from({length:max+1},(_,index)=>[String(index).padStart(4,'0'),index?`Style ${index}`:empty]);
      const control=optionStepper(hairFields,title,appearance[key],options,value=>update(key,value));control.classList.add('roster-compact-select');control.parentElement?.parentElement?.classList.add('roster-style-field')
     }
 }
 window.HLSRosterManager={
  appearanceFields,
  input,optionStepper,colorInput,
  focusId:null,
  render(parent,{league,teamIndex,change,move,freeAgents=false,draftPlayer=null,onAddPlayer=null,onCreatePlayer=null,onCancelPlayer=null,onRemovePlayer=null}){
   const applyChange=change;change=(path,value)=>{applyChange(path,value);for(const rating of parent.querySelectorAll('[data-star-rating]'))rating.syncRating()};
   const role=league.leagueType===1?'Prospect':'Free Agent',group=league.leagueType===1?'Prospects':'Free Agents';
   const team=freeAgents?{name:group,roster:league.freeAgents||[],teamColors:['FFFFFF','102737','808080'],uniforms:[{jersey:'FFFFFF',shorts:'FFFFFF',jerseyStripe:'102737'}]}:league.teams[teamIndex];
   const roster=Array.isArray(team?.roster)?team.roster:[];
   if(!team){parent.append(node('p','','Choose a team to manage its roster.'));return}
   const shell=node('div','roster-manager'),listPanel=node('section','card roster-list-panel'),editor=node('section','card roster-player-panel');
   if(!freeAgents)shell.classList.add('roster-depth-first');
   const search=node('input');search.type='search';search.placeholder='Search roster';search.setAttribute('aria-label','Search roster');
   const list=node('div','roster-list');
   if(!freeAgents)listPanel.append(node('h2','',`${team.city?team.city+' ':''}${team.name} Depth Chart`),node('p','',`${roster.length} players`));listPanel.append(search,list);
   if(onAddPlayer){const add=node('button','primary roster-add-player','Add Player');add.type='button';add.onclick=async()=>{
    if(draftPlayer){active=draftPlayer;drawList();drawEditor();return}
    add.disabled=true;try{await onAddPlayer()}finally{add.disabled=false}
   };listPanel.insertBefore(add,search)}
   if(!freeAgents){const rating=node('div','team-rating-summary','Team rating');rating.append(window.HLSRatings.create(()=>window.HLSRatings.team(team),'Team rating'));listPanel.insertBefore(rating,search)}
   if(freeAgents)shell.classList.add('roster-free-agents');
   shell.append(listPanel,editor);parent.append(shell);
   let active=draftPlayer||(freeAgents?null:roster.find(player=>player.id===this.focusId)||null)||null,selectedUniformIndex=0,selectedSuit=false,navigationPlayers=[];
   const path=(player,...keys)=>player===draftPlayer?['draft',...keys]:freeAgents?['freeAgents',roster.indexOf(player),...keys]:['teams',teamIndex,'roster',roster.indexOf(player),...keys];
   const commit=(player,key,value)=>{change(path(player,key),value);drawList();if(player===draftPlayer)editor.querySelector('h2').textContent=name(player)};
   const closeEditor=()=>{if(!active)return;active=null;this.focusId=null;drawList();drawEditor()};
   const drawList=()=>{navigationPlayers=[];if(freeAgents){shell.append(editor);editor.hidden=!draftPlayer}list.replaceChildren();const query=search.value.trim().toLocaleLowerCase();
   const isStarter=p=>Number.isInteger(p.linePos)&&p.linePos>=0&&p.linePos<5;
   const groups=freeAgents?[{players:roster}]:['PG · Point Guard','SG · Shooting Guard','SF · Small Forward','PF · Power Forward','C · Center','Unassigned'].map(title=>({title,players:[]}));
   if(!freeAgents)for(const player of roster){const position=[0,2,4,6,8].includes(player.teamPos)?player.teamPos:player.pos;const slot=isStarter(player)?player.linePos:Number.isInteger(position)&&position>=0&&position<=8?Math.floor(position/2):5;groups[slot].players.push(player)}
   if(!freeAgents){const columns=node('div','roster-depth-columns');for(const [className,label]of [['roster-player-number','#'],['roster-player-name','Player'],['roster-player-position','Pos'],['roster-player-age','Age'],['roster-player-rating','Rating']])columns.append(node('span',className,label));list.append(columns)}
   for(const group of groups){
    if(group.title==='Unassigned'&&!group.players.length)continue;
    if(!freeAgents)group.players.sort((a,b)=>(Number.isInteger(a.linePos)&&a.linePos>=0?a.linePos:Infinity)-(Number.isInteger(b.linePos)&&b.linePos>=0?b.linePos:Infinity));
    const matches=group.players.filter(player=>name(player).toLocaleLowerCase().includes(query)||String(player.num??'').includes(query));if(query&&!matches.length)continue;
    let target=list;
    if(!freeAgents){target=node('section','roster-depth-position');target.append(node('h3','roster-depth-heading',group.title));list.append(target);if(!query&&!group.players.some(isStarter))target.append(node('p','roster-depth-empty','No starter assigned'))}
    for(const player of matches){
    navigationPlayers.push(player);
    if(freeAgents){
     const entry=node('details','roster-free-agent'),summary=node('summary','',`${player.num??'—'} · ${name(player)} · ${positionNames[player.pos]||(player.pos??'—')}`);entry.open=player===active;
     summary.append(window.HLSRatings.create(()=>window.HLSRatings.player(player),'Player rating',()=>Number.isFinite(player.pot)?player.pot/2:null));
     summary.onclick=event=>{event.preventDefault();active=active===player?null:player;selectedUniformIndex=0;drawList();drawEditor()};entry.append(summary);list.append(entry);if(entry.open){entry.append(editor);editor.hidden=false}continue;
    }
    const button=node('button','roster-player');button.type='button';button.classList.toggle('active',player===active);button.setAttribute('aria-pressed',String(player===active));button.setAttribute('aria-label',`${name(player)}, number ${player.num??'—'}, ${positionNames[player.pos]||(player.pos??'—')}, age ${player.age??'—'}`);button.onclick=()=>{active=player;selectedUniformIndex=0;this.focusId=player.id;drawList();drawEditor()};
    const rating=window.HLSRatings.create(()=>window.HLSRatings.player(player),'Player rating',()=>Number.isFinite(player.pot)?player.pot/2:null);rating.classList.add('roster-player-rating');button.append(node('span','roster-player-number',player.num??'—'),node('span','roster-player-name',name(player)),node('span','roster-player-position',positionNames[player.pos]||(player.pos??'—')),node('span','roster-player-age',player.age??'—'),rating);target.append(button)
   }}if(!list.children.length)list.append(node('p','',freeAgents&&!roster.length?'No players yet.':'No matching players.'))};
   const drawEditor=()=>{
    editor.replaceChildren();shell.classList.toggle('roster-editor-open',!freeAgents&&!!active);if(!active){if(freeAgents)editor.append(node('h2','','No players yet'));else editor.hidden=true;return}
    editor.hidden=false;const player=active,base=path(player),creating=player===draftPlayer;let portraitRedraw=()=>{};
    if(!freeAgents){const close=node('button','roster-editor-close','×');close.type='button';close.setAttribute('aria-label','Close player editor');close.onclick=closeEditor;editor.append(close);
     const navigation=node('nav','roster-player-navigation');navigation.setAttribute('aria-label','Browse roster');const index=navigationPlayers.indexOf(player);
     const switchPlayer=direction=>{const next=navigationPlayers[index+direction];if(!next)return;const opened=new Set([...editor.querySelectorAll('details[open]')].map(el=>el.querySelector(':scope > summary')?.textContent)),scroll=editor.scrollTop;active=next;this.focusId=next.id;drawList();drawEditor();for(const details of editor.querySelectorAll('details'))details.open=opened.has(details.querySelector(':scope > summary')?.textContent);editor.scrollTop=scroll;editor.querySelector(`[aria-label="${direction<0?'Previous':'Next'} player"]`)?.focus({preventScroll:true})};
     const previous=node('button','','←'),next=node('button','','→');previous.type=next.type='button';previous.setAttribute('aria-label','Previous player');next.setAttribute('aria-label','Next player');previous.disabled=index<=0;next.disabled=index<0||index>=navigationPlayers.length-1;previous.onclick=()=>switchPlayer(-1);next.onclick=()=>switchPlayer(1);const count=node('span','',`${index+1} of ${navigationPlayers.length}`);count.setAttribute('aria-live','polite');navigation.append(previous,count,next);editor.append(navigation);
    }
    if(!freeAgents||creating){
     const header=node('div','roster-player-header'),portrait=node('canvas','roster-player-portrait'),info=node('div','roster-player-heading');
     portrait.width=180;portrait.height=146;portrait.setAttribute('role','img');portrait.setAttribute('aria-label',name(player)+' portrait');
     info.append(node('h2','',creating&&!player.fn&&!player.ln?'New '+role:name(player)),node('p','roster-player-id',creating?'Set the player’s details before adding them to '+group+'.':`#${player.num??'—'} · ${positionNames[player.pos]||(player.pos??'—')} · Age ${player.age??'—'}`),window.HLSRatings.create(()=>window.HLSRatings.player(player),'Player rating',()=>Number.isFinite(player.pot)?player.pot/2:null));
     header.append(portrait,info);editor.append(header);portraitRedraw=window.HLSPlayerPreview?.portrait?.(portrait,()=>({player,team,uniformIndex:selectedUniformIndex}))||portraitRedraw
    }
    if(!creating){const moveRow=node('div','roster-move'),target=node('select'),button=node('button','primary','Move player');target.setAttribute('aria-label','Destination team');
    for(const [index,other]of league.teams.entries())if(index!==teamIndex){const option=node('option','',`${other.city?other.city+' ':''}${other.name}`);option.value=String(index);target.append(option)}
    button.type='button';button.textContent=freeAgents?'Add to team':'Move player';button.disabled=!target.options.length;
    button.onclick=()=>freeAgents?move(Number(target.value),player.id):move(teamIndex,Number(target.value),player.id);
    const actions=node('div','roster-player-actions');actions.append(button);
    if(onRemovePlayer){const remove=node('button','roster-remove-player',freeAgents?'Delete':'Release');remove.type='button';remove.onclick=()=>onRemovePlayer(player);actions.append(remove)}
    moveRow.append(target,actions);editor.append(node('h3','',freeAgents?'Add to a team':'Move to another team'),moveRow)}
    const identitySection=node('details','roster-editor-section roster-details-section'),identitySummary=node('summary','','Player Details'),identity=node('div','roster-fields roster-editor-section-content');
    identitySection.append(identitySummary,identity);editor.append(identitySection);
    for(const [key,title]of [['fn','First name'],['ln','Last name'],['tag','Nickname']])if(key in player){const control=input(identity,title,player[key],value=>commit(player,key,value));if(creating&&['fn','ln'].includes(key))control.required=true}
    for(const [key,title]of [['num','Jersey number'],['age','Age'],['ht','Height (inches)'],['wt','Weight (pounds)'],['yrs','Years of experience'],['pot','Potential']])if(key in player)input(identity,title,player[key],value=>commit(player,key,value),{type:'number',min:0,max:key==='num'?99:key==='pot'?10:999,step:1});
    if('pos'in player)optionStepper(identity,'Position',player.pos,positionNames.map((title,id)=>[id,title]),value=>commit(player,'pos',Number(value)));
    const archetypeOptions=[[0,'None'],...archetypes.map((title,index)=>[index+1,title])];
    for(const [key,title]of [['pri','Primary archetype'],['sec','Secondary archetype']])if(key in player)optionStepper(identity,title,player[key],archetypeOptions,value=>{commit(player,key,Number(value));drawEditor()});
    if(player.appearance){
     const appearance=node('div','roster-appearance'),preview=node('div','roster-appearance-preview'),canvas=node('canvas');
     canvas.width=64;canvas.height=84;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Animated player appearance preview');
     let uniformIndex=selectedUniformIndex,suitMode=selectedSuit,redraw=()=>{};
     const outfits=(player.accessories||[]).map((_,index)=>[index,['Home','Road','Alt 1','Alt 2'][index]||`Uniform ${index+1}`]);
     const uniformTabs=node('div','roster-uniform-tabs');uniformTabs.setAttribute('role','group');uniformTabs.setAttribute('aria-label','Uniform appearance');
     for(const [index,title]of outfits){const button=node('button','roster-uniform-tab',title);button.type='button';button.classList.toggle('selected',index===uniformIndex);button.setAttribute('aria-pressed',String(index===uniformIndex));button.onclick=()=>{suitMode=false;suitSettings.hidden=true;accessories.hidden=false;uniformIndex=selectedUniformIndex=index;for(const tab of uniformTabs.children){tab.classList.toggle('selected',tab===button);tab.setAttribute('aria-pressed',String(tab===button))}drawAccessories();redraw()};uniformTabs.append(button)}
     const suitButton=node('button','roster-uniform-tab','Suit');suitButton.type='button';suitButton.setAttribute('aria-pressed','false');uniformTabs.append(suitButton);
     preview.append(canvas,uniformTabs);
     const appearanceSection=node('details','roster-editor-section'),appearanceSettings=node('details','roster-appearance-settings'),fields=node('div','roster-appearance-fields');
     const hairSettings=node('details','roster-appearance-settings'),hairFields=node('div','roster-appearance-fields');
     appearanceSettings.append(node('summary','','Skin & Eyes'),fields);hairSettings.append(node('summary','','Hair'),hairFields);appearance.append(preview,appearanceSettings,hairSettings);
     appearanceSection.append(node('summary','','Appearance'),appearance);editor.append(appearanceSection);
     const update=(key,value)=>{change([...base,'appearance',key],value);redraw()};
     appearanceFields(fields,hairFields,player.appearance,update);
     const accessories=node('div','roster-accessories'),copyRow=node('div','roster-accessory-copy'),copyDestination=node('select'),copyButton=node('button','','Copy to'),accessoryGroups=node('div','roster-accessory-groups');
     copyDestination.setAttribute('aria-label','Copy accessories destination');copyButton.type='button';copyButton.className='roster-copy-accessories';
     copyButton.onclick=()=>{const gear=player.accessories?.[uniformIndex];if(!gear)return;const destination=copyDestination.value,targets=destination==='all'?(player.accessories||[]).map((_,index)=>index).filter(index=>index!==uniformIndex):[Number(destination)].filter(index=>Number.isInteger(index)&&index!==uniformIndex);
      for(const target of targets)change([...base,'accessories',target],JSON.parse(JSON.stringify(gear)))
     };
     copyRow.append(copyDestination,copyButton);accessories.append(accessoryGroups,copyRow);appearance.append(accessories);
     const drawAccessories=()=>{copyDestination.replaceChildren();for(const [index,title]of outfits)if(index!==uniformIndex){const option=node('option','',title);option.value=String(index);copyDestination.append(option)}
      if(outfits.length>2){const all=node('option','','All other uniforms');all.value='all';copyDestination.append(all)}copyButton.disabled=!copyDestination.options.length;
      accessoryGroups.replaceChildren();const gear=player.accessories?.[uniformIndex];if(!gear)return
      const groups=[
       ['Head',[['headAcc','Head accessory','none'],['headAcc2','Second head accessory','0000']],[['headAccC','Head accessory color'],['headAcc2C','Second head accessory color']]],
       ['Arms',[],[['L_Shoulder','Left shoulder'],['R_Shoulder','Right shoulder'],['L_Elbow','Left elbow'],['R_Elbow','Right elbow'],['L_Wrist','Left wrist'],['R_Wrist','Right wrist']]],
       ['Legs',[],[['L_Knee','Left knee'],['R_Knee','Right knee'],['L_Shin','Left shin'],['R_Shin','Right shin']]],
       ['Shoes',[],[['sockC','Socks'],['shoeC','Shoes'],['laceC','Laces'],['soleC','Soles']]]
      ];
      for(const [title,styles,colors]of groups){
       if(!styles.some(([key])=>key in gear)&&!colors.some(([key])=>key in gear))continue;
       const section=node('details','roster-accessory-group'),groupFields=node('div','roster-appearance-fields');section.append(node('summary','',title==='Head'?'Headwear':title),groupFields);accessoryGroups.append(section);
       for(const [key,label,empty]of styles)if(key in gear){
        const options=[[empty,'None'],...Array.from({length:25},(_,i)=>[String(i+1).padStart(4,'0'),`Style ${i+1}`])];
        const control=optionStepper(groupFields,label,gear[key],options,value=>{change([...base,'accessories',uniformIndex,key],value);redraw()});control.classList.add('roster-compact-select')
       }
       for(const [key,label]of colors)if(key in gear)colorInput(groupFields,label,gear[key],value=>{change([...base,'accessories',uniformIndex,key],value);redraw()},team,title==='Arms'||title==='Legs'?()=>player.appearance.skinC:undefined)
      }
     };drawAccessories();
     const suitSettings=node('div','announcer-suit roster-player-suit'),suitFields=node('div','roster-appearance-fields');suitSettings.hidden=true;suitSettings.append(suitFields);appearance.append(suitSettings);
     const defaults={headAcc:'0000',headAccC:'000000',jacketC:'262539',shirtC:'FFFFFF',tieC:'77202D',pantC:'262539',shoeC:'000000',laceC:'',soleC:'000000'};
     const drawSuit=()=>{suitFields.replaceChildren();const suit={...defaults,...player.suits?.[0]};const update=(key,value)=>{const suits=[...(player.suits||[])];suits[0]={...defaults,...suits[0],[key]:value};change([...base,'suits'],suits);redraw()};
      for(const [title,colors]of [['Headwear',[['headAccC','Head accessory color']]],['Clothing',[['jacketC','Jacket'],['shirtC','Shirt'],['tieC','Tie'],['pantC','Pants']]],['Footwear',[['shoeC','Shoes'],['laceC','Laces'],['soleC','Soles']]]]){const group=node('fieldset','suit-group'),body=node('div','suit-group-fields');group.append(node('legend','',title),body);suitFields.append(group);
       if(title==='Headwear')optionStepper(body,'Head accessory',suit.headAcc,Array.from({length:26},(_,i)=>[String(i).padStart(4,'0'),i?`Style ${i}`:'None']),value=>update('headAcc',value));
       for(const [key,label]of colors)colorInput(body,label,suit[key],value=>update(key,value),team);
      }
     };
     suitButton.onclick=()=>{selectedSuit=suitMode=true;accessories.hidden=true;suitSettings.hidden=false;for(const tab of uniformTabs.children){tab.classList.toggle('selected',tab===suitButton);tab.setAttribute('aria-pressed',String(tab===suitButton))}drawSuit();redraw()};
     for(const tab of uniformTabs.children)if(tab!==suitButton)tab.addEventListener('click',()=>selectedSuit=false);
     if(selectedSuit)suitButton.click();
     const animatedRedraw=window.HLSPlayerPreview.mount(canvas,()=>({player:suitMode?{...player,suits:[{...defaults,...player.suits?.[0]}]}:player,team:suitMode?{...team,suitPreview:true}:team,uniformIndex:suitMode?0:uniformIndex}));redraw=()=>{animatedRedraw();portraitRedraw()};
    }
    const attributeSection=node('details','roster-editor-section roster-attributes-section'),attributeSummary=node('summary','','Attributes'),attributeContent=node('div','roster-editor-section-content'),attributes=node('div','roster-attributes');
    attributeContent.append(attributes);attributeSection.append(attributeSummary,attributeContent);editor.append(attributeSection);
    for(const [key,levels]of Object.entries(player.attributes||{})){if(!Array.isArray(levels)||levels.length<2)continue;const group=node('div','roster-attribute');group.append(node('strong','',attributeNames[key]||key));
     for(const [index,title]of ['Current','Potential'].entries())input(group,title,levels[index],value=>change([...base,'attributes',key,index],value),{type:'number',min:index===1?levels[0]:0,max:index===0?levels[1]:20,step:1});attributes.append(group)}
    const skillSection=node('details','roster-editor-section roster-skills-section'),skillSummary=node('summary','','Skills'),skills=node('div','roster-skills roster-editor-section-content');skillSection.append(skillSummary,skills);editor.append(skillSection);
    const refreshSkills=()=>{skills.replaceChildren();for(const [index,skill]of (player.skills||[]).entries()){
     const group=node('div','roster-skill');const available=[...new Set([...skillIds.filter(id=>!(player.skills||[]).some((entry,i)=>i!==index&&entry.id===id)),skill.id])].sort();
     const description=node('p','roster-skill-description',skillDescriptions[skill.id]||'Description unavailable for this imported skill.');
     const skillSelect=select(group,'Skill',skill.id,available.map(id=>[id,skillNames[id]||id]),value=>{change([...base,'skills',index,'id'],value);description.textContent=skillDescriptions[value]||'Description unavailable for this imported skill.'});skillSelect.parentElement.classList.add('roster-skill-name');group.append(description);
     input(group,'Level',skill.level,value=>change([...base,'skills',index,'level'],value),{type:'number',min:0,max:99,step:1});
     input(group,'XP Available',skill.xp,value=>change([...base,'skills',index,'xp'],value),{type:'number',min:0,max:999999,step:1});
     const equipped=node('label','roster-check'),check=node('input');check.type='checkbox';check.checked=!!skill.equipped;check.onchange=()=>change([...base,'skills',index,'equipped'],check.checked);equipped.append(check,' Equipped');group.append(equipped);
     const remove=node('button','','Remove skill');remove.type='button';remove.onclick=()=>{change([...base,'skills'],player.skills.filter((_,i)=>i!==index));refreshSkills()};group.append(remove);skills.append(group)
    }const add=node('button','','Add skill');add.type='button';const nextSkill=skillIds.find(id=>!(player.skills||[]).some(skill=>skill.id===id));add.disabled=!nextSkill;add.onclick=()=>{change([...base,'skills'],[...(player.skills||[]),{id:nextSkill,xp:0,level:1,equipped:false}]);refreshSkills()};skills.append(add)};refreshSkills();
    if(creating){const actions=node('div','roster-draft-actions'),create=node('button','primary','Create '+role),cancel=node('button','','Cancel');
     create.type=cancel.type='button';create.onclick=()=>onCreatePlayer?.(player);cancel.onclick=()=>onCancelPlayer?.();actions.append(create,cancel);editor.append(actions)}
   };
   parent._hlsRosterOutsideController?.abort?.();
   if(!freeAgents){
    const controller=new AbortController();parent._hlsRosterOutsideController=controller;
    document.addEventListener('click',event=>{
     if(!active||!shell.isConnected)return;
     const target=event.target;if(!(target instanceof Element)||editor.contains(target))return;
     event.preventDefault();event.stopImmediatePropagation();
     closeEditor()
    },{capture:true,signal:controller.signal})
   }
   search.oninput=drawList;drawList();drawEditor();
  }
 };
})();

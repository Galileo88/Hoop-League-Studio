(()=>{
 const node=(tag,className='',text)=>{const item=document.createElement(tag);item.className=className;if(text!==undefined)item.textContent=text;return item};
 const outfitNames=['Home','Road','Alt 1','Alt 2'];
 const defaultSuit={headAcc:'0000',headAccC:'000000',jacketC:'262539',shirtC:'FFFFFF',tieC:'77202D',pantC:'262539',shoeC:'000000',laceC:'',soleC:'000000'};
 const defaultAppearance={skinC:'EEA160',eyeC:'000000',unibrow:false,browC:'000000',hair:'0000',hairC:'262539',fHair:'0000',fHairC:'262539'};
 window.HLSAnnouncerEditor={initialize(person){person.appearance={...defaultAppearance};person.suits=Array.from({length:4},()=>({...defaultSuit}));return person},render(parent,{team,path,change,addAnnouncer,collection='announcers',personLabel=(_,index)=>`Announcer ${index+1}`,groupLabel='Announcers',previewLabel='announcer',renderProfile,renderExtra,renderMissing,renderCard}){
  let selected=0,outfit=0;
  const people=()=>Array.isArray(team.frontOffice?.[collection])?team.frontOffice[collection]:[];
  const controls=window.HLSRosterManager;
  const previewTeam={...team,suitPreview:true};
  const draw=()=>{
   parent.replaceChildren();
   const choices=node('div','announcer-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label',groupLabel);parent.append(choices);
   const portraits=[];
   people().forEach((person,index)=>{
    const button=node('button','announcer-choice'),portrait=node('canvas'),name=node('span','announcer-choice-name');
    portrait.width=180;portrait.height=146;portrait.setAttribute('aria-hidden','true');button.type='button';button.setAttribute('aria-label',personLabel(person,index));button.setAttribute('aria-pressed',String(selected===index));
    button.append(portrait,node('strong','',personLabel(person,index)),name);button.onclick=()=>{selected=index;outfit=0;draw()};choices.append(button);
    renderCard?.(button,person);
    const redraw=window.HLSPlayerPreview.portrait(portrait,()=>({player:person,team:previewTeam,uniformIndex:selected===index?outfit:0}));portraits.push({name,person,redraw});
   });
   const syncNames=()=>portraits.forEach(({name,person})=>name.textContent=[person.fn,person.ln].filter(Boolean).join(' ')||`Unnamed ${previewLabel}`);syncNames();
   if(addAnnouncer&&people().length<2){
    const add=node('button','primary','Add Announcer'),status=node('p');add.type='button';status.setAttribute('role','status');parent.append(add,status);
    add.onclick=async()=>{add.disabled=true;try{await addAnnouncer();if(!parent.isConnected)return;selected=people().length-1;outfit=0;draw()}catch(error){status.textContent=error.message;add.disabled=false}};
   }
   renderMissing?.(choices,index=>{selected=index;outfit=0;draw()});
   const person=people()[selected];if(!person){parent.append(node('p','',`Add a ${previewLabel} to edit their name, appearance, and suits.`));return}
   const base=[...path,'frontOffice',collection,selected],editor=node('div','announcer-person-editor');parent.append(editor);
   if(renderProfile)renderProfile(editor,person,base,syncNames);
   else{const identity=node('div','roster-fields');editor.append(identity);for(const [key,title]of [['fn','First name'],['ln','Last name']])controls.input(identity,title,person[key]||'',value=>{change([...base,key],value);syncNames()})}
   const preview=node('div','roster-appearance-preview'),canvas=node('canvas'),outfits=node('div','roster-uniform-tabs');canvas.width=64;canvas.height=84;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Animated ${previewLabel} appearance preview`);outfits.setAttribute('role','group');outfits.setAttribute('aria-label','Suit variant');
   const displayPerson=()=>({...person,appearance:{...defaultAppearance,...person.appearance},suits:Array.from({length:4},(_,index)=>({...defaultSuit,...person.suits?.[index]}))});
   preview.append(canvas,outfits,node('small','','Appearance preview may differ slightly in Hoop Land.'));editor.append(preview);
   const animated=window.HLSPlayerPreview.mount(canvas,()=>({player:displayPerson(),team:previewTeam,uniformIndex:outfit}));
   const redraw=()=>{animated();portraits.forEach(p=>p.redraw())};
   const appearance=node('details','roster-editor-section'),appearanceBody=node('div','roster-appearance');appearance.append(node('summary','','Appearance'),appearanceBody);editor.append(appearance);
   const fields=node('div','roster-appearance-fields'),hairFields=node('div','roster-appearance-fields');
   for(const [title,content]of [['Skin & Eyes',fields],['Hair',hairFields]]){const section=node('details','roster-appearance-settings');section.append(node('summary','',title),content);appearanceBody.append(section)}
   controls.appearanceFields(fields,hairFields,displayPerson().appearance,(key,value)=>{if(!person.appearance)change([...base,'appearance'],{...defaultAppearance});change([...base,'appearance',key],value);redraw()});
   const suitSection=node('details','roster-editor-section announcer-suit'),suitFields=node('div','roster-appearance-fields'),copy=node('div','roster-accessory-copy'),destination=node('select'),copyButton=node('button','','Copy suit');
   const copyLabel=node('label','suit-copy-label'),copySource=node('strong');copyLabel.append(node('span','','Copy to'),destination);
   destination.setAttribute('aria-label','Copy suit destination');copyButton.type='button';copy.append(copySource,copyLabel,copyButton);suitSection.append(node('summary','','Suit'),suitFields,copy);editor.append(suitSection);
   const saveSuit=(index,suit)=>{const suits=[...(person.suits||[])];while(suits.length<=index)suits.push({...defaultSuit});suits[index]=suit;change([...base,'suits'],suits)};
   const drawSuit=()=>{
    suitFields.replaceChildren();destination.replaceChildren();const suit=displayPerson().suits[outfit];
    const update=(key,value)=>{saveSuit(outfit,{...displayPerson().suits[outfit],[key]:value});redraw()};
    copySource.textContent=`Copy ${outfitNames[outfit]} suit`;
    for(const [title,colors]of [['Headwear',[['headAccC','Head accessory color']]],['Clothing',[['jacketC','Jacket'],['shirtC','Shirt'],['tieC','Tie'],['pantC','Pants']]],['Footwear',[['shoeC','Shoes'],['laceC','Laces'],['soleC','Soles']]]]){
     const group=node('fieldset','suit-group'),body=node('div','suit-group-fields');group.append(node('legend','',title),body);suitFields.append(group);
     if(title==='Headwear')controls.optionStepper(body,'Head accessory',suit.headAcc,Array.from({length:26},(_,index)=>[String(index).padStart(4,'0'),index?`Style ${index}`:'None']),value=>update('headAcc',value));
     for(const [key,label]of colors)controls.colorInput(body,label,suit[key],value=>update(key,value),team);
    }
    outfitNames.forEach((name,index)=>{if(index!==outfit){const option=node('option','',name);option.value=String(index);destination.append(option)}});const all=node('option','','All other suits');all.value='all';destination.append(all);
   };
   copyButton.onclick=()=>{const targets=destination.value==='all'?[0,1,2,3].filter(index=>index!==outfit):[Number(destination.value)],source=displayPerson().suits[outfit];for(const index of targets)saveSuit(index,structuredClone(source));redraw()};
   outfitNames.forEach((name,index)=>{const button=node('button','roster-uniform-tab',name);button.type='button';const sync=()=>{button.classList.toggle('selected',outfit===index);button.setAttribute('aria-pressed',String(outfit===index))};button.sync=sync;sync();button.onclick=()=>{outfit=index;for(const child of outfits.children)child.sync();drawSuit();redraw()};outfits.append(button)});
   drawSuit();
   renderExtra?.(editor,person,base);
  };draw();
 }};
})();

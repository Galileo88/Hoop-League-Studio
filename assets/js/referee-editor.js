(()=>{
 const node=(tag,className='',text)=>{const element=document.createElement(tag);element.className=className;if(text!==undefined)element.textContent=text;return element};
 let defaultsPromise;
 const defaults=()=>defaultsPromise||(defaultsPromise=fetch('./data/referee-defaults.json').then(response=>{if(!response.ok)throw Error('Could not load referee defaults.');return response.json()}).catch(error=>{defaultsPromise=null;throw error}));
 window.HLSRefereeEditor={render(parent,{league,change}){
  let selected=0,busy=false;
  const refs=()=>Array.isArray(league.referees)?league.referees:[];
  const draw=()=>{
   parent.replaceChildren();
   const toolbar=node('div','referee-toolbar'),add=node('button','primary','Add Referee'),status=node('p');
   status.setAttribute('role','status');add.type='button';add.disabled=busy||refs().length>=4;
   toolbar.append(node('p','',`${refs().length} / 4 custom referees`),add);parent.append(toolbar,status);
   add.onclick=async()=>{
    if(busy||refs().length>=4)return;busy=true;add.disabled=true;
    try{const records=await defaults();if(!parent.isConnected)return;if(refs().length<4){selected=refs().length;change(['referees'],[...refs(),structuredClone(records[selected])])}}
    catch(error){status.textContent=error.message;busy=false;add.disabled=refs().length>=4;return}
    busy=false;draw();
   };
   if(!refs().length){parent.append(node('p','','No custom referees yet. Add a referee to customize their appearance.'));return}
   selected=Math.min(selected,refs().length-1);
   const tabs=node('div','roster-uniform-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Referees');
   refs().forEach((ref,index)=>{const button=node('button','roster-uniform-tab',`Referee ${index+1}`);button.type='button';button.classList.toggle('selected',index===selected);button.setAttribute('aria-pressed',String(index===selected));button.onclick=()=>{selected=index;draw()};tabs.append(button)});parent.append(tabs);
   const ref=refs()[selected],editor=node('div','roster-appearance referee-appearance'),preview=node('div','roster-appearance-preview'),canvas=node('canvas');
   canvas.width=64;canvas.height=84;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Animated referee ${selected+1} appearance preview`);preview.append(canvas);editor.append(preview);
   const fields=node('div','roster-appearance-fields'),hairFields=node('div','roster-appearance-fields');
   for(const [title,content]of [['Skin & Eyes',fields],['Hair',hairFields]]){const section=node('details','roster-appearance-settings');section.open=true;section.append(node('summary','',title),content);editor.append(section)}
   parent.append(editor);
   const displayAppearance=()=>({skinC:'EEA160',eyeC:'000000',unibrow:false,browC:'000000',hair:'0000',fHair:'0000',...ref.appearance,hairC:ref.appearance?.hairC||'FFFFFF',fHairC:ref.appearance?.fHairC||'FFFFFF'});
   const appearance=displayAppearance();
   const redraw=window.HLSPlayerPreview.mount(canvas,()=>({player:{appearance:displayAppearance()},team:{refereePreview:true},uniformIndex:0}));
   window.HLSRosterManager.appearanceFields(fields,hairFields,appearance,(key,value)=>{
    if(!ref.appearance)change(['referees',selected,'appearance'],{...appearance});
    change(['referees',selected,'appearance',key],value);redraw();
   });
   const remove=node('button','','Remove Referee');remove.type='button';remove.onclick=()=>{change(['referees'],refs().filter((_,index)=>index!==selected));selected=Math.max(0,selected-1);draw()};parent.append(remove);
  };draw();
 }};
})();

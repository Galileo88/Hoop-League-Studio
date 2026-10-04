(()=>{
 const node=(tag,cls='',text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el};
 const roles={0:'General Manager',1:'Head Coach',2:'Development',3:'Trainer',4:'Scout',5:'Analyst',6:'Insider'};
 const rating=person=>{const values=['development','motivation','leadership'].map(key=>person.attributes?.[key]?.[0]);return values.every(value=>Number.isInteger(value)&&value>=0&&value<=20)?Math.fround(Math.min(1,Math.max(.1,(values.reduce((a,b)=>a+b,0)-8)/40))*5):null};
 const tendencyOptions={offFocus:['Offensive focus','Balanced','Inside','Midrange','Outside'],offTempo:['Offensive tempo','Average','Fast Paced'],offRebounding:['Offensive rebounding','Balanced','Crash Boards','Get Back on D'],defFocus:['Defensive focus','Balanced','Interior','Perimeter'],defAggression:['Defensive aggression','Average','Physical','Conservative'],defRebounding:['Defensive rebounding','Balanced','Crash Boards','Fast Break'],benchDepth:['Bench depth','Average','Deep','Short'],benchUtilization:['Bench utilization','Low','Medium','High'],closingLineup:['Closing lineup','Starters','Performance']};
 window.HLSCoachEditor={roles,rating,render(parent,{team,path,league,change,addCoach}){
  const controls=window.HLSRosterManager;
  const section=(parent,title)=>{const details=node('details','roster-editor-section'),body=node('div','roster-fields');details.append(node('summary','',title),body);parent.append(details);return body};
  const number=(parent,title,value,save,options={})=>{const input=controls.input(parent,title,value,save,{type:'number',min:0,max:2147483647,step:1,...options});input.addEventListener('input',()=>input.setCustomValidity(''));return input};
  window.HLSAnnouncerEditor.render(parent,{team,path,change,collection:'staff',groupLabel:'Coaches',previewLabel:'coach',personLabel:person=>roles[person.pos]||`Staff role ${person.pos}`,
   renderMissing(choices,select){for(const role of [1,2,3,4])if(!(team.frontOffice?.staff||[]).some(person=>person.pos===role)){const button=node('button','announcer-choice',`Add ${roles[role]}`);button.type='button';choices.append(button);button.onclick=async()=>{button.disabled=true;try{await addCoach(role);if(choices.isConnected)select(team.frontOffice.staff.findIndex(person=>person.pos===role))}catch(error){button.disabled=false;let status=choices.querySelector('[role=status]');if(!status){status=node('p');status.setAttribute('role','status');choices.append(status)}status.textContent=error.message}}}},
   renderCard(card,person){if(person.pos===1){const stars=window.HLSRatings.create(()=>rating(person),'Coach rating',()=>Number.isFinite(person.pot)?person.pot/2:null);stars.classList.add('coach-card-rating');card.classList.add('coach-head-card');card.append(stars)}},
   renderProfile(editor,person,base,syncNames){
    const body=person.pos===1?section(editor,'Profile'):node('div','roster-fields');
    if(person.pos!==1)editor.append(body);
    for(const [key,title]of [['fn','First name'],['ln','Last name']])controls.input(body,title,person[key]||'',value=>{change([...base,key],value);syncNames()});
    if(person.pos!==1)return;
    for(const [key,title]of [['home','Hometown'],['tag','Hoop Gram username']])controls.input(body,title,person[key]||'',value=>change([...base,key],value));
    for(const [key,title]of [['age','Age'],['yrs','Years pro'],['ht','Height (inches)'],['wt','Weight (lbs)']])number(body,title,person[key],value=>change([...base,key],value));
   },
   renderExtra(editor,person,base){
    if(person.pos!==1)return;
    // Create absent containers only when edited; opening imported records is lossless.
    const save=(keys,value)=>{let object=person;keys.slice(0,-1).forEach((key,index)=>{if(!object[key])change([...base,...keys.slice(0,index+1)],{});object=object[key]});change([...base,...keys],value)};
    const attributes=section(editor,'Attributes');
    for(const [key,title,options]of [['arc','Archetype',['Balanced','Inside Offense','Midrange Offense','Outside Offense','Defensive Minded']],['pri','Primary strength',['Development','Motivation','Leadership']],['sec','Secondary strength',['Development','Motivation','Leadership']]])controls.optionStepper(attributes,title,person[key]??0,options.map((label,index)=>[index,label]),value=>save([key],Number(value)));
    number(attributes,'Potential (stars)',Number.isFinite(person.pot)?person.pot/2:0,value=>save(['pot'],value*2),{max:5,step:.5});
    for(const [key,title]of [['development','Development'],['motivation','Motivation'],['leadership','Leadership']]){
     const current=()=>person.attributes?.[key]||[0,0];
     number(attributes,title,current()[0]/2,value=>{const pair=[...current()];pair[0]=value*2;pair[1]=Math.max(pair[1],pair[0]);save(['attributes',key],pair);cap.value=pair[1]/2},{max:10,step:.5});
     const cap=number(attributes,`${title} potential`,current()[1]/2,value=>{const pair=[...current()];pair[1]=Math.max(value*2,pair[0]);save(['attributes',key],pair);cap.value=pair[1]/2},{max:10,step:.5});
    }
    attributes.append(node('small','','Ratings use the game’s 0–10 scale. Potential cannot be lower than the current rating.'));
    const tendencies=section(editor,'Tendencies');for(const [key,[title,...options]]of Object.entries(tendencyOptions))controls.optionStepper(tendencies,title,person.tendencies?.[key]??0,options.map((label,index)=>[index,label]),value=>save(['tendencies',key],Number(value)));
    const contract=section(editor,'Contract');for(const [key,title]of [['sal','Salary ($M)'],['yrs','Contract years']])number(contract,title,person.contract?.[key]??0,value=>save(['contract',key],value));
    const stats=section(editor,'Stats');for(const [period,label]of [['season','Season'],['playoffs','Playoff']])for(const [key,title]of [['W','wins'],['L','losses']])number(stats,`${label} ${title}`,person.career?.[period]?.[key]??0,value=>save(['career',period,key],value));
    const awards=section(editor,'Awards'),list=node('div','coach-award-list');awards.append(list);
    const drawAwards=()=>{
     list.replaceChildren();
     const entries=(person.awards||[]).flatMap((award,index)=>(award.yearsWon||[]).map((year,yearIndex)=>({award,index,year,yearIndex}))).sort((a,b)=>a.year-b.year);
     for(const {award,index,year,yearIndex}of entries){
      const definition=(league.awards||[]).find(item=>item.id===award.id),label=award.id===0?'CHAMP':definition?.shortName||'AWARD';
      const card=node('div','coach-award'),trophy=node('img');
      trophy.src='./assets/images/trophies/championship.png';trophy.alt='';trophy.width=64;trophy.height=64;
      card.setAttribute('role','group');card.setAttribute('aria-label',`${label} ${year}`);card.append(node('strong','coach-award-year',year),trophy,node('span','',label));
      const remove=node('button','coach-award-remove','−');remove.type='button';remove.setAttribute('aria-label',`Remove ${label} ${year}`);remove.title=`Remove ${label} ${year}`;
      remove.onclick=()=>{const records=structuredClone(person.awards);records[index].yearsWon.splice(yearIndex,1);if(!records[index].yearsWon.length)records.splice(index,1);save(['awards'],records);drawAwards()};card.append(remove);list.append(card);
     }
     if(!entries.length)list.append(node('p','','No awards added.'));
    };drawAwards();
    const awardForm=node('div','coach-award-form'),awardControls=node('div','coach-award-controls');awardForm.append(node('strong','','Championship'),awardControls);awards.append(awardForm);
    let year=league.season?.currentYear||league.season?.startingYear||0;const yearInput=number(awardControls,'Year won',year,value=>year=value);
    const add=node('button','','Add championship');add.type='button';add.onclick=()=>{if(!yearInput.value||!yearInput.reportValidity())return;const records=structuredClone(person.awards||[]),id=0,record=records.find(item=>item.id===id&&item.league===league.leagueType);if(record)record.yearsWon=[...new Set([...(record.yearsWon||[]),year])];else records.push({id,league:league.leagueType,yearsWon:[year],position:0});save(['awards'],records);drawAwards()};awardControls.append(add);
   }
  });
 }};
})();

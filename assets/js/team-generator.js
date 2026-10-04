/* Assemble generated players and staff into complete league records. */
(()=>{
  'use strict';
  const core=typeof module!=='undefined'&&module.exports?require('./generation-prototype.js'):window.HLSGenerationPrototype;
  const ratings=typeof module!=='undefined'&&module.exports?require('./star-rating.js'):window.HLSRatings;
  const skills=typeof module!=='undefined'&&module.exports?require('./player-generation-skills.js'):window.HLSGenerationSkills;
  const defaultSkills=typeof module!=='undefined'&&module.exports?require('./data/generation-skills.json'):null;
  const clone=value=>structuredClone(value),pick=(items,rng)=>items[rng.int(0,items.length)];
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const tendencyKeys=['dunk','floater','hook','post','twoPoint','threePoint','pumpFake','fades','pass','lob','cross','spin','step','offReb','runPlay','defReb','takeCharge','stealOnBall','stealOffBall','block'];
  const tendencyAttributes=['DNK','INS','INS','INS','MID','TPT','MID','MID','PAS','PAS','DRB','DRB','DRB','ORE','PAS','DRE','BLK','STL','STL','BLK'];
  const tendencySpread=[2,2,2,2,2,2,3,3,2,3,3,3,3,2,2,2,2,3,3,2];
  function roundEven(n){const lo=Math.floor(n);return n-lo===.5?(lo%2===0?lo:lo+1):Math.round(n)}
  function tendencies(player,rng){
    const result=Object.fromEntries(tendencyKeys.map((key,i)=>[key,clamp(roundEven((player.attributes[tendencyAttributes[i]][0]-10)/2)+rng.int(-tendencySpread[i],tendencySpread[i]+1),-5,5)]));
    if(player.gender===1)result.dunk=-5;
    return result;
  }
  function coachAttributes(current,potential,caps,rng){
    const pairs=caps.map(cap=>[2,cap]);
    const poolFor=()=>pairs.flatMap((pair,i)=>Array(pair[1]).fill(i));
    let pool=poolFor(),left=(current+2)*4-6;
    for(let iteration=0;left>0&&!pairs.every(([v,c])=>v>=c);iteration++){
      if(iteration>10000)throw Error('Coach attribute allocation did not converge');
      const index=pick(pool,rng),pair=pairs[index];
      if(pair[0]>=pair[1]){
        for(let n=0;n<pair[1];n++){const at=pool.indexOf(index);if(at!==-1)pool.splice(at,1)}
      }else{
        const amount=rng.int(1,Math.min(3,left,pair[1]-pair[0]+1));pair[0]+=amount;left-=amount;
      }
      const points=(potential+2)*4-pairs.reduce((sum,p)=>sum+p[0],0);
      for(const p of pairs)if(p[1]-p[0]>points)p[1]=clamp(p[0]+points,0,20);
      if(!pool.length)pool=poolFor();
    }
    return pairs;
  }
  function location(value){
    // A few bundled US cities use ten-thousandths instead of hundredths.
    const scale=Math.abs(value.x)>9000||Math.abs(value.y)>18000?100:1;
    return {x:Math.round(value.x/scale),y:Math.round(value.y/scale)};
  }
  function appearance(person,catalog,rng){
    const available=entries=>entries.filter(entry=>(entry.gender===person.gender||entry.gender===2)&&(entry.age===2||entry.age===(person.age>=35?1:0)));
    const hair=available(catalog.hair),facial=available(catalog.facialHair);
    const color=pick(catalog.colors.hair,rng);
    // Valid catalog choices; native ethnicity/rarity weighting is not yet ported.
    return {skinC:pick(catalog.colors.skin,rng),eyeC:pick(catalog.colors.eyes,rng),unibrow:rng.value()<.01,browC:color,hair:pick(hair,rng)?.id||'0000',hairC:color,fHair:person.gender===0&&rng.value()<.35?(pick(facial,rng)?.id||'0000'):'0000',fHairC:color};
  }
  function suits(catalog,rng){
    return Array.from({length:4},()=>{
      const jacket=pick(catalog.colors.hair,rng);
      return {headAcc:'0000',headAccC:'000000',jacketC:jacket,shirtC:pick(catalog.colors.accessories,rng),tieC:pick(catalog.colors.accessories,rng),pantC:jacket,shoeC:'000000',laceC:'',soleC:'000000'};
    });
  }
  function accessories(skin){
    return ['FFFFFF','PRI','SEC','TER'].map(color=>({headAcc:'none',headAccC:color,headAcc2:'0000',headAcc2C:'',L_Shoulder:skin,R_Shoulder:skin,L_Elbow:skin,R_Elbow:skin,L_Wrist:skin,R_Wrist:skin,L_Knee:skin,R_Knee:skin,L_Shin:skin,R_Shin:skin,sockC:color,shoeC:color,laceC:'FFFFFF',soleC:'FFFFFF'}));
  }
  function coachRating(years,rng){
    const range=years<=2?[3,6]:years<=6?[4,8]:years<=12?[5,10]:years<=16?[3,9]:[3,7];
    const current=rng.int(...range),roll=Math.fround(rng.value());
    const potential=roll>Math.fround(.99)?10:roll>Math.fround(.95)?9:roll>Math.fround(.65)?8:roll>Math.fround(.3)?7:roll>Math.fround(.1)?6:5;
    return [current,Math.max(current,potential)];
  }
  function create(data,blueprints,playerBlueprint,catalog,{seed=42,type='pro',gender=0,teamId=1,firstPersonId=1,division=0,skillCatalog=defaultSkills}={}){
    if(!skillCatalog?.skills)throw Error('Skill catalog is required');
    for(const value of [teamId,firstPersonId])if(!Number.isSafeInteger(value)||value<1||value>2147483600)throw RangeError('IDs must be positive game integers');
    const profile=core.generate(data,{seed,type,gender});
    // A separate random stream keeps player profiles stable when other records change.
    const rng=core.random((seed^0x9e3779b9)>>>0),team=clone(blueprints.team);
    let nextId=firstPersonId;
    const usedNames=new Set(profile.roster.map(p=>p.fn+' '+p.ln));
    const home=person=>{
      const city=pick(data.cities,rng);person.ctry='US';person.home='';person.loc=location(city.location);
    };
    const name=person=>{
      const first=person.gender===1?data.names.femaleFirst:data.names.first;
      const last=person.gender===1&&data.names.femaleLast.length?data.names.femaleLast:data.names.last;
      for(let attempt=0;attempt<1000;attempt++){
        person.fn=pick(first,rng);person.ln=pick(last,rng);
        const full=person.fn+' '+person.ln;
        if(!usedNames.has(full)){usedNames.add(full);return}
      }
      throw Error('Could not generate a unique staff name');
    };
    Object.assign(team,{id:teamId,city:profile.city,name:profile.name,shortName:profile.name.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase(),arenaName:profile.city+' Arena',tag:profile.name,division,location:location(data.cities.find(c=>c.name===profile.city).location)});
    team.teamColors=pick([['154FA1','FADE73','FFFFFF'],['C22E3A','DBE0E7','141020'],['306943','F5AB44','FFFFFF'],['7E3E85','FADE73','FFFFFF']],rng).slice();
    team.court.baseline1=team.city.toUpperCase();team.court.baseline2=team.name.toUpperCase();
    const numbers=Array.from({length:100},(_,i)=>i);
    team.roster=profile.roster.map(raw=>{
      const p=clone(playerBlueprint),{stars,...values}=raw;
      Object.assign(p,values,{id:nextId++,tid:teamId,league:type==='college'?1:0});
      p.attributes={...clone(playerBlueprint.attributes),...clone(raw.attributes)};
      p.num=numbers.splice(rng.int(0,numbers.length),1)[0];
      p.arc=data.archetypes[p.pri-1].name;
      home(p);p.appearance=appearance(p,catalog,rng);p.accessories=accessories(p.appearance.skinC);p.suits=suits(catalog,rng);
      p.tendencies=tendencies(p,rng);p.skills=skills.assign(p,skillCatalog);
      return p;
    });
    function staff(pos,headCoach=false){
      const p=clone(blueprints.staff);
      const staffGender=headCoach?(gender===2?rng.int(0,2):gender):rng.int(0,2);
      Object.assign(p,{id:nextId++,tid:teamId,league:type==='college'?1:0,pos,gender:staffGender});
      p.age=rng.int(headCoach?35:40,headCoach?60:70);
      if(headCoach){
        p.yrs=p.age-rng.int(35,p.age);p.pri=rng.int(0,3);p.sec=rng.int(0,3);
        // Balanced strategy is intentional until native coach style weights are ported.
        p.arc=0;
        const [current,potential]=coachRating(p.yrs,rng);p.pot=potential;
        const caps=[0,1,2].map(i=>(i===p.pri?12:8)+(i===p.sec?8:6));
        const values=coachAttributes(current,potential,caps,rng);
        p.attributes=Object.fromEntries(['development','motivation','leadership'].map((key,i)=>[key,values[i]]));
        Object.assign(p,core.dimensions(rng.int(0,9),p.gender,rng));
      }
      name(p);home(p);p.appearance=appearance(p,catalog,rng);p.suits=suits(catalog,rng);
      return p;
    }
    team.frontOffice.staff=[staff(1,true),staff(2),staff(3),staff(4)];
    team.frontOffice.announcers=[staff(0),staff(0)];
    ratings.rebuildLineups({teams:[team]},true);
    validate(team);
    return {team,nextPersonId:nextId,seed,type,gender};
  }
  function validate(team){
    const people=[...team.roster,...team.frontOffice.staff,...team.frontOffice.announcers],ids=new Set();
    for(const p of people){
      if(!Number.isInteger(p.id)||p.id<1||ids.has(p.id))throw Error('Invalid or duplicated person ID');ids.add(p.id);
      if(p.tid!==team.id)throw Error('Person assigned to wrong team');
      if(!p.fn||!p.ln)throw Error('Missing generated name');
      for(const pair of Object.values(p.attributes))if(pair.length!==2||pair.some(n=>!Number.isInteger(n)||n<0||n>20)||pair[0]>pair[1])throw Error('Invalid attribute pair');
    }
    const rosterIds=new Set(team.roster.map(p=>p.id));
    if(team.startingLineup.length!==team.roster.length||new Set(team.startingLineup.map(slot=>slot.pid)).size!==team.roster.length||team.startingLineup.some(slot=>!rosterIds.has(slot.pid)))throw Error('Invalid generated lineup');
    if(new Set(team.roster.map(p=>p.num)).size!==team.roster.length)throw Error('Duplicate jersey number');
    return true;
  }
  function testLeague(source,generated){
    const league=clone(source),index=0,target=league.teams[index];
    if(!target)throw Error('Test league has no team slot');
    const people=[];
    function visit(value){
      if(!value||typeof value!=='object')return;
      if('fn' in value&&'ln' in value&&Number.isInteger(value.id))people.push(value.id);
      for(const child of Object.values(value))if(child&&typeof child==='object')visit(child);
    }
    visit(league);
    let next=Math.max(0,Number(league.meta.uPID)||0,...people)+1;
    const team=clone(generated.team),mapping=new Map();
    for(const p of [...team.roster,...team.frontOffice.staff,...team.frontOffice.announcers]){mapping.set(p.id,next);p.id=next++;p.tid=target.id;p.league=league.leagueType}
    team.id=target.id;team.division=target.division;team.rnk=target.rnk;
    for(const slot of team.startingLineup)slot.pid=mapping.get(slot.pid);
    validate(team);league.teams[index]=team;
    league.leagueName='Studio Generation Test';league.shortName='SGT';league.meta.saveName='StudioGenerationTest-'+generated.seed;
    league.meta.uPID=next-1;league.meta.gender=generated.gender;
    return league;
  }
  function createLeague(source,data,blueprints,playerBlueprint,catalog,{seed=42,gender=source.meta?.gender||0,skillCatalog=defaultSkills}={}){
    const league=clone(source),type=league.leagueType===1?'college':'pro';
    if(![0,1].includes(league.leagueType))throw Error('Choose a Pro or College league');
    let next=Math.max(0,Number(league.meta.uPID)||0)+1;
    // Reserve identities in league personnel and any other retained records.
    function visit(value){
      if(!value||typeof value!=='object')return;
      if('fn' in value&&'ln' in value&&Number.isInteger(value.id))next=Math.max(next,value.id+1);
      for(const child of Object.values(value))if(child&&typeof child==='object')visit(child);
    }
    visit(league);
    const rng=core.random(seed),used=new Set();
    league.teams=league.teams.map(slot=>{
      for(let attempt=0;attempt<1000;attempt++){
        const generated=create(data,blueprints,playerBlueprint,catalog,{seed:rng.int(0,0x100000000),type,gender,teamId:slot.id,firstPersonId:next,division:slot.division,skillCatalog});
        const identity=generated.team.city+' '+generated.team.name;
        if(used.has(identity))continue;
        used.add(identity);next=generated.nextPersonId;generated.team.rnk=slot.rnk;
        return generated.team;
      }
      throw Error('Could not generate unique team identities');
    });
    league.meta.uPID=next-1;league.meta.teams=league.teams.length;league.meta.gender=gender;
    return league;
  }
  function expandLeague(source,target,data,blueprints,playerBlueprint,catalog,{seed=42,skillCatalog=defaultSkills}={}){
    if(![0,1].includes(source.leagueType))throw Error('Generation supports Pro and College leagues');
    if(!Number.isInteger(target)||target<source.teams.length||target>64)throw Error('Invalid team count');
    const league=clone(source),rng=core.random(seed),used=new Set(league.teams.map(t=>(t.city+' '+t.name).toLowerCase()));
    let next=Math.max(0,Number(league.meta?.uPID)||0)+1;
    function visit(value){
      if(!value||typeof value!=='object')return;
      if('fn' in value&&'ln' in value&&Number.isInteger(value.id))next=Math.max(next,value.id+1);
      for(const child of Object.values(value))if(child&&typeof child==='object')visit(child);
    }
    visit(league);
    let teamId=Math.max(0,...[...league.teams,...(league.starTeams||[])].map(t=>Number(t.id)||0))+1;
    while(league.teams.length<target){
      const totals=Array(Math.max(1,league.divisions?.length||1)).fill(0);
      for(const team of league.teams)if(team.division>=0&&team.division<totals.length)totals[team.division]++;
      const division=totals.indexOf(Math.min(...totals));let accepted=false;
      for(let attempt=0;attempt<1000;attempt++){
        const result=create(data,blueprints,playerBlueprint,catalog,{seed:rng.int(0,0x100000000),type:league.leagueType===1?'college':'pro',gender:league.meta?.gender||0,teamId,firstPersonId:next,division,skillCatalog});
        const identity=(result.team.city+' '+result.team.name).toLowerCase();if(used.has(identity))continue;
        used.add(identity);result.team.rnk=league.teams.length+1;league.teams.push(result.team);
        next=result.nextPersonId;teamId++;accepted=true;break;
      }
      if(!accepted)throw Error('Could not generate unique expansion teams');
    }
    league.meta||={};league.meta.uPID=next-1;league.meta.teams=league.teams.length;
    return league;
  }
  function regenerateLeague(source,data,blueprints,playerBlueprint,catalog,{seed=42,gender=source.meta?.gender??0,skillCatalog=defaultSkills}={}){
    if(![0,1].includes(source.leagueType))throw Error('Generation supports Pro and College leagues');
    const league=clone(source),type=league.leagueType===1?'college':'pro',rng=core.random(seed);
    let next=Math.max(0,Number(league.meta?.uPID)||0)+1;
    function visit(value){
      if(!value||typeof value!=='object')return;
      if('fn' in value&&'ln' in value&&Number.isInteger(value.id))next=Math.max(next,value.id+1);
      for(const child of Object.values(value))if(child&&typeof child==='object')visit(child);
    }
    visit(league);
    league.teams=league.teams.map(oldTeam=>{
      const result=create(data,blueprints,playerBlueprint,catalog,{seed:rng.int(0,0x100000000),type,gender,teamId:oldTeam.id,firstPersonId:next,division:oldTeam.division,skillCatalog});
      next=result.nextPersonId;
      const replacement=result.team;
      for(const key of ['isPlayer','city','name','shortName','arenaName','logoURL','tag','logoSize','location','division','rnk','teamColors','uniforms','court','draftPicks','retiredNumbers','headToHeads','scoringOptions','quickPlays','coinFlip','status','championships','following'])if(Object.hasOwn(oldTeam,key))replacement[key]=clone(oldTeam[key]);
      replacement.currentLineup=oldTeam.currentLineup||0;replacement.lineupPreset=oldTeam.lineupPreset||0;
      replacement.frontOffice={...clone(oldTeam.frontOffice||{}),staff:replacement.frontOffice.staff,announcers:replacement.frontOffice.announcers};
      return replacement;
    });
    league.meta||={};league.meta.uPID=next-1;league.meta.gender=gender;
    return league;
  }
  const api={create,createLeague,expandLeague,regenerateLeague,validate,testLeague,tendencies,coachAttributes};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.HLSTeamGenerator=api;
})();

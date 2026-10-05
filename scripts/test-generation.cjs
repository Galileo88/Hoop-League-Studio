const assert = require('node:assert/strict');
const { test } = require('node:test');
const core = require('../assets/js/generation-prototype.js');
const data = require('../data/generation-prototype.json');
const teams = require('../assets/js/team-generator.js');
const blueprints = require('../data/team-generation-blueprints.json');
const player = require('../data/player-blueprint.json');
const appearance = require('../data/generation-appearance.json');

test('native US ethnicity thresholds coordinate skin and hair palettes', () => {
  for(let roll=0;roll<100;roll++){
    const black=roll<50,white=roll>=50&&roll<95;
    for(const upper of [false,true]){
      let calls=0;
      const rng={int:(lo,hi)=>calls++===0?roll:upper?hi-1:lo};
      const actual=teams.appearanceColors('US',appearance,rng);
      const skin=black?(upper?6:3):white?(upper?2:0):(upper?4:0);
      assert.deepEqual(actual,{skinC:appearance.colors.skin[skin],hairC:appearance.colors.hair[upper?(white?8:1):0]});
    }
  }
});

test('native country skin overrides and unknown-country fallback are preserved', () => {
  const expected=[[[0,2],[3,6],[0,4]],[[0,2],[3,6],[0,2]],[[2,4],[2,4],[2,4]],[[0,2],[4,6],[4,6]]];
  for(let skin=0;skin<4;skin++)for(let ethnicity=0;ethnicity<3;ethnicity++)for(const upper of [false,true]){
    const catalog={...appearance,countries:{XX:{skin,white:ethnicity===0?100:0,black:ethnicity===1?100:0,asian:ethnicity===2?100:0}}};
    const colors=teams.appearanceColors('XX',catalog,{int:(lo,hi)=>upper?hi-1:lo});
    assert.equal(colors.skinC,appearance.colors.skin[expected[skin][ethnicity][upper?1:0]]);
    assert.equal(colors.hairC,appearance.colors.hair[upper?(ethnicity===0?8:1):0]);
  }
  assert.deepEqual(teams.appearanceColors('unknown',appearance,{int:(lo,hi)=>hi-1}),{skinC:appearance.colors.skin[6],hairC:appearance.colors.hair[8]});
});

test('generated US players and staff use coordinated colors', () => {
  for(let seed=0;seed<30;seed++){
    const {team}=teams.create(data,blueprints,player,appearance,{seed,gender:seed%3,meta:{generatedCountries:[{country:'US',value:100}]}});
    for(const p of [...team.roster,...team.frontOffice.staff,...team.frontOffice.announcers]){
      const a=p.appearance;
      if(appearance.colors.skin.indexOf(a.skinC)>=3)assert.ok(appearance.colors.hair.indexOf(a.hairC)<2);
      assert.equal(a.browC,a.hairC);
      assert.equal(a.fHairC,a.hairC);
    }
  }
});

test('country percentages preserve unassigned random-country probability and empty defaults',()=>{
  const meta={generatedCountries:[{country:'FR',value:25},{country:'JP',value:25}]};
  for(const [roll,expected] of [[0,'FR'],[24,'FR'],[25,'JP'],[49,'JP'],[50,'AL'],[99,'AL']]){
    let n=0;assert.equal(teams.randomCountry(data,meta,'pro',{int:()=>n++?0:roll}),expected);
  }
  assert.equal(teams.randomCountry(data,{},'pro',{int:()=>74}),'US');
  assert.equal(teams.randomCountry(data,{},'college',{int:()=>89}),'US');
  assert.equal(teams.randomCountry(data,{countryGeneration:1,generatedCountries:[]},'pro',{int:()=>0}),'AL');
});

test('all countries generate matching gender names and hometowns',()=>{
  for(const [code,country] of Object.entries(data.countries))for(const gender of [0,1]){
    const p={gender};teams.identity(p,data,{generatedCountries:[{country:code,value:100}]},'pro',new Set(),core.random(42));
    const {first,last}=teams.namePools(p,data);
    assert.ok(first.includes(p.fn)&&last.includes(p.ln),code);
    assert.notEqual(p.fn,p.ln);assert.equal(p.ctry,code);
    const cities=country.states.length?country.states.flatMap(s=>s.cities):country.cities;
    assert.ok(cities.some(c=>{const scale=Math.abs(c.location.x)>9000||Math.abs(c.location.y)>18000?100:1;return Math.round(c.location.x/scale)===p.loc.x&&Math.round(c.location.y/scale)===p.loc.y}),code);
  }
});

test('create, regenerate and expand honor league countries and preserve existing records',()=>{
  const source={leagueType:0,meta:{uPID:100,gender:1,generatedCountries:[{country:'JP',value:100}]},divisions:['Division'],teams:[{...structuredClone(blueprints.team),id:1,division:0,rnk:1,roster:[]}]};
  const before=structuredClone(source);
  for(const operation of ['createLeague','regenerateLeague','expandLeague']){
    const args=operation==='expandLeague'?[source,3]:[source];
    const result=teams[operation](...args,data,blueprints,player,appearance,{seed:42});
    const generated=operation==='expandLeague'?result.teams.slice(1):result.teams;
    for(const t of generated)for(const p of [...t.roster,...t.frontOffice.staff,...t.frontOffice.announcers]){
      assert.equal(p.ctry,'JP');const {first,last}=teams.namePools(p,data);assert.ok(first.includes(p.fn)&&last.includes(p.ln));
    }
    if(operation==='expandLeague')assert.deepEqual(result.teams[0],source.teams[0]);
    assert.deepEqual(source,before);
  }
});

test('league generation, regeneration and expansion reserve names across all teams and history', () => {
  for (const leagueType of [0, 1]) {
    const seed = 42;
    const firstSeed = core.random(seed).int(0, 0x100000000);
    const collision = core.generate(data, {seed:firstSeed, type:leagueType ? 'college' : 'pro'}).roster[0];
    const source = {
      leagueType, meta:{uPID:10000,gender:0}, divisions:['Division'],
      teams:Array.from({length:32}, (_, i) => ({...structuredClone(blueprints.team),id:i+1,division:0,rnk:i+1,roster:[]})),
      retirees:[{...collision,id:10000,fn:collision.fn.toUpperCase(),awards:[{id:2,league:leagueType,yearsWon:[1990]}]}]
    };
    const before = structuredClone(source);
    for (const operation of ['createLeague','regenerateLeague','expandLeague']) {
      const args = operation === 'expandLeague' ? [source,64] : [source];
      const result = teams[operation](...args,data,blueprints,player,appearance,{seed});
      const people = result.teams.flatMap(t => [...t.roster,...(t.frontOffice?.staff||[]),...(t.frontOffice?.announcers||[])]);
      const names = [...people,...result.retirees].map(p => (p.fn+' '+p.ln).toLowerCase());
      assert.equal(new Set(names).size,names.length,operation+' repeated a name');
      assert.deepEqual(result.retirees,source.retirees,'Historical careers must stay unchanged');
      assert.deepEqual(source,before,'Generation must not mutate the source');
      assert.deepEqual(result,teams[operation](...args,data,blueprints,player,appearance,{seed}),'Names must be reproducible');
    }
  }
});

function leagueProfiles(seed, type, gender) {
  const rng = core.random(seed);
  return Array.from({ length: 64 }, () =>
    core.generate(data, { seed: rng.int(0, 0x100000000), type, gender }).roster
  ).flat();
}

test('Pro and College expansion support 128 teams with unique identities and complete rosters',()=>{
  for(const leagueType of [0,1]){
    const source={leagueType,meta:{uPID:0,gender:0},divisions:['A','B','C','D'],teams:[]};
    const expanded=teams.expandLeague(source,128,data,blueprints,player,appearance,{seed:42});
    assert.equal(expanded.teams.length,128);
    assert.equal(expanded.meta.teams,128);
    assert.equal(new Set(expanded.teams.map(t=>t.id)).size,128);
    assert.equal(new Set(expanded.teams.map(t=>(t.city+' '+t.name).toLowerCase())).size,128);
    const people=expanded.teams.flatMap(t=>[...t.roster,...t.frontOffice.staff,...t.frontOffice.announcers]);
    assert.equal(new Set(people.map(p=>p.id)).size,people.length);
    assert.ok(expanded.meta.uPID>=Math.max(...people.map(p=>p.id)));
    for(const team of expanded.teams)assert.equal(teams.validate(team),true);
    assert.deepEqual(source.teams,[]);
    assert.throws(()=>teams.expandLeague(expanded,129,data,blueprints,player,appearance),/Invalid team count/);
  }
});

test('team seeds do not produce overlapping player profiles', () => {
  for (const seed of [0, 1, 42, 123456789, 0xffffffff]) {
    for (const type of ['pro', 'college']) {
      for (const gender of [0, 1, 2]) {
        const players = leagueProfiles(seed, type, gender);
        // Ignore local IDs: the same player in another slot is still a clone.
        const profiles = players.map(({ id, ...profile }) => JSON.stringify(profile));
        assert.equal(new Set(profiles).size, players.length,
          `Repeated profile for seed ${seed}, ${type}, gender ${gender}`);
      }
    }
  }
});

test('generation remains reproducible with the same seed', () => {
  assert.deepEqual(leagueProfiles(42, 'pro', 0), leagueProfiles(42, 'pro', 0));
});

test('random values and derived seeds stay within their allowed bounds', () => {
  for (const seed of [0, 0xffffffff]) {
    const rng = core.random(seed);
    for (let i = 0; i < 10000; i++) {
      const value = rng.value();
      assert.ok(value >= 0 && value < 1);
      const childSeed = rng.int(0, 0x100000000);
      assert.ok(Number.isInteger(childSeed) && childSeed >= 0 && childSeed <= 0xffffffff);
    }
  }
});

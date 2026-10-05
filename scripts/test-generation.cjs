const assert = require('node:assert/strict');
const { test } = require('node:test');
const core = require('../assets/js/generation-prototype.js');
const data = require('../data/generation-prototype.json');
const teams = require('../assets/js/team-generator.js');
const blueprints = require('../data/team-generation-blueprints.json');
const player = require('../data/player-blueprint.json');
const appearance = require('../data/generation-appearance.json');

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

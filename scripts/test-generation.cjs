const assert = require('node:assert/strict');
const { test } = require('node:test');
const core = require('../assets/js/generation-prototype.js');
const data = require('../data/generation-prototype.json');

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

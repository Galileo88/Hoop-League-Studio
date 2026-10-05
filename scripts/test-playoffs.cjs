const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');

// Exercise the app's helpers without starting its browser UI.
const source=fs.readFileSync(require.resolve('../assets/js/app.js'),'utf8');
const helpers=source.slice(source.indexOf('function playoffRoundCount('),source.indexOf('function renderPlayoffs('));
const context=vm.createContext({});
vm.runInContext(helpers,context);
const {playoffRoundCount,playoffRoundNames,normalizePlayoffRounds}=context;
const league=(playoffTeams,leagueType=0,seriesLength=[2,3,4,2,0,0])=>({leagueType,season:{playoffTeams,seriesLength}});
const names=data=>Array.from(playoffRoundNames(data));

test('round counts match the installed game at every bracket boundary and uneven counts',()=>{
 for(const [teams,rounds] of [[0,2],[2,2],[4,2],[5,3],[6,3],[8,3],[9,4],[12,4],[16,4],[17,5],[24,5],[32,5],[33,6],[48,6],[64,6],[65,6]])assert.equal(playoffRoundCount(teams),rounds,String(teams));
});

test('pro and college labels follow Hoop Land for small and large brackets',()=>{
 assert.deepEqual(names(league(4)),['Round 1','Championship']);
 assert.deepEqual(names(league(12)),['Round 1','Round 2','Round 3','Championship']);
 assert.deepEqual(names(league(64)),['Round 1','Round 2','Round 3','Round 4','Round 5','Championship']);
 assert.deepEqual(names(league(4,1)),['First Round','Championship']);
 assert.deepEqual(names(league(6,1)),['First Round','Top 4','Championship']);
 assert.deepEqual(names(league(12,1)),['First Round','Top 8','Top 4','Championship']);
 assert.deepEqual(names(league(24,1)),['First Round','Top 16','Top 8','Top 4','Championship']);
 assert.deepEqual(names(league(64,1)),['First Round','Top 32','Top 16','Top 8','Top 4','Championship']);
});

test('expansion activates zero-filled slots and shrinking preserves chosen lengths',()=>{
 for(const [type,fallback] of [[0,3],[1,1]]){
  const data=league(16,type);
  assert.equal(normalizePlayoffRounds(data),false);
  data.season.playoffTeams=32;normalizePlayoffRounds(data);
  assert.deepEqual(Array.from(data.season.seriesLength),[2,3,4,2,fallback,0]);
  data.season.playoffTeams=64;normalizePlayoffRounds(data);
  data.season.seriesLength[5]=4;
  data.season.playoffTeams=4;normalizePlayoffRounds(data);
  data.season.playoffTeams=64;normalizePlayoffRounds(data);
  assert.deepEqual(Array.from(data.season.seriesLength),[2,3,4,2,fallback,4]);
  assert.equal(normalizePlayoffRounds(data),false);
 }
});

test('play-in toggles and export normalization preserve all six regular-round choices',()=>{
 const data=league(64,0,[1,2,3,4,2,4]);
 for(const enabled of [true,false,true]){
  data.season.playInTournament=enabled;normalizePlayoffRounds(data);
  assert.deepEqual(JSON.parse(JSON.stringify(data)).season.seriesLength,[1,2,3,4,2,4]);
 }
});

test('missing and invalid active lengths receive valid league defaults',()=>{
 for(const [type,fallback] of [[0,3],[1,1]]){
  const data=league(64,type,[0,null,undefined,5,-1,2.5]);
  assert.equal(normalizePlayoffRounds(data),true);
  assert.deepEqual(Array.from(data.season.seriesLength),Array(6).fill(fallback));
  delete data.season.seriesLength;normalizePlayoffRounds(data);
  assert.deepEqual(Array.from(data.season.seriesLength),Array(6).fill(fallback));
 }
 assert.equal(normalizePlayoffRounds({}),false);
});

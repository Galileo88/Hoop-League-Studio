(function(root){
 'use strict';
 const rounds=['firstRound','secondRound','top16','top8','top4','championship'];
 function customCourt(data,round){return data.tournamentCourts?.[round]||data.courts?.[rounds.indexOf(round)]||null}
 function defaultCourt(data,fallback={}){
  return {...(data.court||data.defaultCourt||data.teams?.[0]?.court||fallback),logoSize:3,logoLayer:1,overlayURL:'',overlayLayer:0};
 }
 // Hoop Land reads LeagueData.courts by round index; an empty list loads its stock courts.
 // Keep legacy editor overrides until export so existing saved drafts remain recoverable.
 function forExport(data,fallback){
  const result=structuredClone(data);
  if(data.leagueType!==1)return result;
  if(rounds.some(round=>customCourt(data,round))){
   result.courts=Array.isArray(result.courts)?result.courts:[];
   rounds.forEach((round,index)=>{result.courts[index]=structuredClone(customCourt(data,round)||defaultCourt(data,fallback))});
  }
  delete result.tournamentCourts;
  return result;
 }
 const api={rounds,customCourt,defaultCourt,forExport};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.HLSTournamentCourts=api;
})(typeof window==='object'?window:globalThis);

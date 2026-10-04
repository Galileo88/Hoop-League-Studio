/* Custom-league skill selection matching the game's cost priority. */
(()=>{
  'use strict';
  const keys=['LAY','DNK','INS','MID','TPT','FTS','DRB','PAS','ORE','DRE','STL','BLK'];
  const f=Math.fround;
  const offense=[.5,1.5,1,1,2,.5,1.5,1,1,0,0,0],defense=[0,0,0,0,0,0,0,0,0,3,3,4];
  function metrics(p){
    const values=keys.map(k=>p.attributes[k][0]);
    const component=weights=>f(values.reduce((sum,v,i)=>f(sum+f(f(v/20)*weights[i])),0)/6);
    return {offense:component(offense),defense:component(defense),rating:f(f(Math.max(.1,f((Math.min(168,values.reduce((a,b)=>a+b,0))-28)/140)))*10)};
  }
  function shouldEquip(p,id,m=metrics(p)){
    m={offense:f(m.offense),defense:f(m.defense),rating:f(m.rating)};
    const a=k=>p.attributes[k][0],t=p.tendencies;
    switch(id){
      case 'HIG':return a('DNK')>=10&&t.dunk>3;
      case 'CRA':return a('LAY')>=16;
      case 'SOF':return a('INS')>=16&&t.hook>3;
      case 'TEA':return a('INS')>=16&&t.floater>3;
      case 'BUL':return p.wt>200&&a('INS')>=16&&t.post>3;
      case 'DUN':return a('DNK')>=16&&t.dunk>3;
      case 'SPA':return m.offense>f(.8)&&m.rating<7;
      case 'CLU':return a('MID')+a('TPT')>30&&t.twoPoint+t.threePoint>5;
      case 'SPO':return (a('MID')>=10&&t.twoPoint>0)||(a('TPT')>=10&&t.threePoint>0&&t.step<0);
      case 'VOL':return (a('MID')>=10&&t.twoPoint>3)||(a('TPT')>=10&&t.threePoint>3);
      case 'LIM':return a('TPT')>=16&&t.threePoint>3;
      case 'UNF':return a('MID')>=16&&t.twoPoint>3&&p.ht>75;
      case 'DIM':return a('PAS')>=12&&t.pass>1;
      case 'CHE':return a('PAS')>=16&&t.pass>3;
      case 'CLE':return a('ORE')>=16&&t.offReb>3;
      case 'STE':return a('MID')+a('TPT')>20&&a('DRB')>=16&&t.step>3;
      case 'FOO':return a('DRB')>=16&&t.cross>3;
      case 'HOT':return m.offense>=f(.8)&&a('PAS')>=16&&t.pass>3;
      case 'CLA':return a('BLK')>=10&&t.block<0;
      case 'LOC':return (m.defense>=f(.8)&&t.stealOffBall>3)||t.stealOnBall>3||t.block>3;
      case 'MAG':return a('DRE')>=10&&t.defReb>3;
      case 'TWO':return m.defense>=f(.8)&&m.offense>=.5;
      case 'BAL':return a('STL')>=16&&m.defense>=f(.8)&&t.stealOffBall>3;
      case 'SNA':return a('BLK')>=16&&t.block>3;
      default:return false;
    }
  }
  function budget(p){
    const total=keys.reduce((sum,k)=>sum+p.attributes[k][0],0);
    return Math.max(0,Math.min(p.league===1?5:Infinity,Math.floor(f((Math.floor(total*.5)-14)/5))+1));
  }
  function assign(p,catalog){
    const counts=[0,0,0,0],result=[],m=metrics(p);let remaining=budget(p);
    // Native priority is descending cost among eligible skills. Equal costs use
    // catalog order here for reproducibility rather than mutable global sort state.
    for(const skill of [...catalog.skills].sort((a,b)=>b.cost-a.cost)){
      if(skill.cost>remaining||counts[skill.category]>=4)continue;
      if(skill.attribute&&p.attributes[keys[skill.attribute-1]][0]<skill.minRating)continue;
      if(!shouldEquip(p,skill.id,m))continue;
      result.push({id:skill.id,xp:0,level:1,equipped:true});remaining-=skill.cost;counts[skill.category]++;
    }
    return result;
  }
  const api={assign,budget,metrics,shouldEquip};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.HLSGenerationSkills=api;
})();

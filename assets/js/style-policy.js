/* Apply the user's approved styles without changing other player data. */
(()=>{
 'use strict';
 const allowed=typeof module!=='undefined'&&module.exports?require('./allowed-styles.js'):window.HLSAllowedStyles;
 const genderKey=gender=>gender===0?'male':gender===1?'female':null;
 function normalize(value){return /^\d{1,4}$/.test(String(value))?String(value).padStart(4,'0'):String(value)}
 function repair(data){
  let players=0,hairstyles=0,accessories=0;
  const visited=new WeakSet();
  function visit(value){
   if(!value||typeof value!=='object'||visited.has(value))return;
   visited.add(value);
   const key=genderKey(value.gender);
   if(key&&value.appearance&&value.attributes?.LAY&&Number.isInteger(value.id)){
    let changed=false;
    const hair=value.appearance.hair;
    if(hair!==undefined&&!allowed.hair[key].includes(normalize(hair))){
     const pool=allowed.hair[key];
     // Stable across roster and all-star copies of the same player.
     const hash=Math.imul(value.id^0x9e3779b9,0x85ebca6b)>>>0;
     value.appearance.hair=pool[hash%pool.length];hairstyles++;changed=true;
    }
    for(const outfits of [value.accessories,value.suits])for(const outfit of Array.isArray(outfits)?outfits:[]){
     for(const field of ['headAcc','headAcc2']){
      const id=outfit[field];
      if(id===undefined||id===null||id===''||id==='none'||normalize(id)==='0000')continue;
      if(!allowed.accessories[key].includes(normalize(id))){outfit[field]=field==='headAcc'?'none':'0000';accessories++;changed=true}
     }
    }
    if(changed)players++;
   }
   for(const child of Object.values(value))if(child&&typeof child==='object')visit(child);
  }
  visit(data);return {players,hairstyles,accessories};
 }
 const api={allowed,repair};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof window!=='undefined')window.HLSStylePolicy=api;
})();

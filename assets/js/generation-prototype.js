/* Seeded player generation shared by the league generator. */
(()=>{
  'use strict';
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)), f=Math.fround;
  const sizes=[[72,76,160,210],[73,77,165,220],[74,78,170,230],[76,80,180,240],[77,81,190,245],[78,82,200,250],[80,84,220,260],[82,86,230,270],[83,87,240,290]];
  const archetypePools=[[5,8,9,4],[5,8,9,4],[8,9,10,4],[1,8,9,10,4],[1,8,10,4],[10,2,7,6],[7,3,6,2],[7,3,6,2],[7,3,6,2]];
  function random(seed){
    if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Seed must be an unsigned 32-bit integer');
    let state=seed;
    const value=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296};
    return {value,int:(lo,hi)=>hi<=lo?lo:lo+Math.floor(value()*(hi-lo))};
  }
  const pick=(items,rng)=>items[rng.int(0,items.length)];
  function age(type,rng){
    let roll=rng.int(0,100);
    const ranges=type==='college'?[[17,17,20],[18,18,30],[19,19,30],[20,20,20]]:[[19,22,25],[23,27,35],[28,32,25],[33,37,10],[38,40,5]];
    for(const [lo,hi,weight] of ranges){if(roll<weight)return lo===hi?lo:rng.int(lo,hi+1);roll-=weight}
    throw new Error('Invalid age roll');
  }
  function collegeRating(rng){
    const roll=f(rng.value());
    for(const [threshold,rating] of [[.001,10],[.005,9],[.1,8],[.7,7],[.9,6]])if(roll<f(threshold))return rating;
    return rng.int(3,6);
  }
  function ratings(type,age,years,rng){
    if(type==='college'){
      const current=collegeRating(rng);
      return [current,Math.max(4,current,collegeRating(rng))];
    }
    const range=years<=2?[3,6]:years<=6?[4,8]:years<=12?[5,10]:years<=16?[3,9]:[3,7];
    const base=rng.int(...range),roll=rng.int(1,101);
    const delta=roll<=50?[-1,2]:roll<=80?[-2,0]:roll<=95?[0,2]:[1,3];
    const current=clamp(base+rng.int(...delta),age>30?5:3,10);
    if(age>30)return [current,current];
    const v=f(rng.value());
    const potential=v>f(.99)?10:v>f(.95)?9:v>f(.65)?8:v>f(.3)?7:v>f(.1)?6:5;
    return [current,Math.max(current,potential)];
  }
  function dimensions(pos,gender,rng){
    const [h0,h1,w0,w1]=sizes[pos];
    let ht=rng.int(h0,h1+1),wt=rng.int(w0,w1+1);
    if(f(rng.value())<.05){
      ht+=rng.int(-3,4);wt+=rng.int(-20,21);
      if(f(rng.value())<.01){ht+=rng.int(2,5);wt-=rng.int(10,21)}
    }
    if(gender===1){ht-=5;wt-=45}
    return {ht,wt};
  }
  function archetypes(pos,gender,rng){
    const pool=gender===1?archetypePools[pos].filter(id=>id!==2):archetypePools[pos];
    let pri=pick(pool,rng);
    if(f(rng.value())<f(.2))pri=rng.int(1,11);
    let sec=pick(pool,rng);
    if(f(rng.value())<f(.5))sec=rng.int(1,11);
    return {pri,sec};
  }
  function capsFor(data,pos,pri,sec){
    return data.base[pos].map((n,i)=>{
      const a=data.archetypes[pri-1].bonuses[i],b=data.archetypes[sec-1].bonuses[i];
      return n*2+a*2+(b===0?0:b===1?2:b*2-2);
    });
  }
  function distribute(current,potential,caps,rng){
    if(!Number.isInteger(current)||current<3||current>10||!Number.isInteger(potential)||potential<current||potential>10||caps.length!==12||caps.some(n=>!Number.isInteger(n)||n<2||n>20))throw new RangeError('Invalid attribute generation input');
    const attributes=caps.map(cap=>[2,cap]);
    const makePool=()=>attributes.flatMap((a,i)=>Array(a[1]).fill(i));
    let pool=makePool(),remaining=(current+2)*14-24;
    for(let iterations=0;remaining>0;iterations++){
      if(iterations>100000)throw new Error('Attribute allocation did not converge');
      const index=pick(pool,rng),pair=attributes[index];
      if(pair[0]>=pair[1]){
        // The native loop removes up to the current cap's number of copies.
        for(let n=0;n<pair[1];n++){const at=pool.indexOf(index);if(at!==-1)pool.splice(at,1)}
      }else{
        const amount=rng.int(1,Math.min(3,remaining,pair[1]-pair[0]+1));
        pair[0]+=amount;remaining-=amount;
      }
      const allMaxed=attributes.every(([value,cap])=>value>=cap);
      const points=(potential+2)*14-attributes.reduce((sum,a)=>sum+a[0],0);
      for(const a of attributes){
        if(allMaxed&&points>a[1]-a[0])a[1]=clamp(a[0]+clamp(points,0,potential>9?6:3),0,20);
        else if(a[1]-a[0]>points)a[1]=clamp(a[0]+points,0,20);
      }
      if(!pool.length)pool=makePool();
    }
    return attributes;
  }
  function generate(data,{seed=1,type='pro',gender=0}={}){
    if(!['pro','college'].includes(type)||![0,1,2].includes(gender))throw new RangeError('Invalid league type or gender');
    const rng=random(seed),city=pick(data.cities,rng),name=pick(data.teamNames,rng);
    const usedNames=new Set();
    // Deliberately fixed prototype roster coverage, not the game's team builder.
    const roster=[0,2,4,6,8,0,2,4,6,8].map((pos,i)=>{
      const playerGender=gender===2?(i===0?0:i===1?1:rng.int(0,2)):gender;
      const first=playerGender===1?data.names.femaleFirst:data.names.first;
      const last=playerGender===1&&data.names.femaleLast.length?data.names.femaleLast:data.names.last;
      const p={id:i+1,pos,gender:playerGender,age:age(type,rng)};
      p.yrs=p.age-(type==='college'?17:19);
      const [current,potential]=ratings(type,p.age,p.yrs,rng);
      Object.assign(p,dimensions(pos,gender,rng),archetypes(pos,gender,rng));
      const values=distribute(current,potential,capsFor(data,pos,p.pri,p.sec),rng);
      p.pot=potential;
      p.attributes=Object.fromEntries(data.keys.map((key,j)=>[key,values[j]]));
      p.stars=current/2;
      for(let attempt=0;attempt<100;attempt++){
        p.fn=pick(first,rng);p.ln=pick(last,rng);
        const full=p.fn+' '+p.ln;
        if(!usedNames.has(full)){usedNames.add(full);return p}
      }
      throw new Error('Unable to select a unique name');
    });
    return {seed,type,gender,city:city.name,name,roster};
  }
  const api={random,age,ratings,dimensions,archetypes,capsFor,distribute,generate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.HLSGenerationPrototype=api;
})();

(()=>{
 const root='./assets/images/players/';
 const files=['idle','referee-idle','suit-idle','head','eye-white','eye-color','brow-color','unibrow-color','hair','facial-hair','head-accessories'];
 const images={};
 for(const file of files){const image=new Image();image.src=root+file+'.png';images[file]=image}
 const hex=(value,fallback)=>/^#?[\da-f]{6}$/i.test(String(value||''))?'#'+String(value).replace('#',''):fallback;
 const color=(value,team,fallback)=>{
  const slot={PRI:0,SEC:1,TER:2}[String(value||'').toUpperCase()];
  return hex(slot===undefined?value:team?.teamColors?.[slot],fallback);
 };
 const rgb=value=>{const v=hex(value,'#ffffff');return [1,3,5].map(i=>parseInt(v.slice(i,i+2),16))};
 function shade(base,scale){return base.map(channel=>Math.max(0,Math.min(255,Math.round(channel*scale))))}
 function paint(ctx,image,sx,sy,tint){
  if(!image.complete||!image.naturalWidth)return;
  const off=document.createElement('canvas');off.width=off.height=32;
  const layer=off.getContext('2d',{willReadFrequently:true});layer.drawImage(image,sx,sy,32,32,0,0,32,32);
  if(tint){const data=layer.getImageData(0,0,32,32),base=rgb(tint);
   for(let i=0;i<data.data.length;i+=4){if(!data.data[i+3])continue;
    const [r,g,b]=data.data.slice(i,i+3);if(r<25&&g<25&&b<25)continue;
    const next=shade(base,r>230?1.1:r<190?.75:1);
    data.data[i]=next[0];data.data[i+1]=next[1];data.data[i+2]=next[2]
   }layer.putImageData(data,0,0)
  }ctx.drawImage(off,0,0)
 }
 function atlas(ctx,image,code,columns,tint,frame){const number=Number(code);if(!Number.isInteger(number)||number<1)return;
  const x=number%columns*64+(frame%2)*32,y=Math.floor(number/columns)*64;
  paint(ctx,image,x,y,tint)
 }
 const skinShades={'220,129,88':1,'215,85,66':.78,'225,174,120':1.15,'195,36,58':.65};
 const shortsStarts=[21,22,23,22];
 const numberGlyphs={
  '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
  '2':['111','001','111','100','111'],'3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'],'5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'],'7':['111','001','010','010','010'],
  '8':['111','101','111','101','111'],'9':['111','101','111','001','111']
 };
 function body(ctx,frame,player,team,uniformIndex){
  const image=images[team?.suitPreview?'suit-idle':team?.refereePreview?'referee-idle':'idle'];if(!image.complete||!image.naturalWidth)return null;
  const off=document.createElement('canvas');off.width=off.height=32;
  const layer=off.getContext('2d',{willReadFrequently:true});layer.drawImage(image,frame*32,0,32,32,0,0,32,32);
  const pixels=layer.getImageData(0,0,32,32),source=new Uint8ClampedArray(pixels.data);
  const skinColor=hex(player.appearance?.skinC,'#dc8158'),skin=rgb(skinColor);
  const suit=player.suits?.[uniformIndex]||player.suits?.[0]||{};
  const suitColor=(key,fallback)=>rgb(color(suit[key],team,fallback));
  const uniform=team?.uniforms?.[uniformIndex]||team?.uniforms?.[0]||{};
  const gear=player.accessories?.[uniformIndex]||player.accessories?.[0]||{};
  const jersey=rgb(color(uniform.jersey,team,'#147dff')),shorts=rgb(color(uniform.shorts,team,'#147dff'));
  const jerseyStripe=rgb(color(uniform.jerseyStripe,team,color(uniform.jersey,team,'#147dff')));
  const jerseyCollar=rgb(color(uniform.jerseyCollar,team,color(uniform.jerseyStripe,team,color(uniform.jersey,team,'#147dff'))));
  const shortsStripe=rgb(color(uniform.shortsStripe,team,color(uniform.shorts,team,'#147dff')));
  const shortsStart=shortsStarts[frame]??22;
  const uniformRows=Array.from({length:32},()=>({min:32,max:-1}));
  for(let i=0;i<source.length;i+=4){const r=source[i],b=source[i+2],a=source[i+3];if(!a||b!==255||r>40)continue;const pixel=Math.floor(i/4),x=pixel%32,y=Math.floor(pixel/32),row=uniformRows[y];row.min=Math.min(row.min,x);row.max=Math.max(row.max,x)}
  const gearRgb=(key,fallback)=>rgb(color(gear[key],team,fallback));
  const accessory={
   L_Shoulder:gearRgb('L_Shoulder',skinColor),R_Shoulder:gearRgb('R_Shoulder',skinColor),
   L_Elbow:gearRgb('L_Elbow',skinColor),R_Elbow:gearRgb('R_Elbow',skinColor),
   L_Wrist:gearRgb('L_Wrist',skinColor),R_Wrist:gearRgb('R_Wrist',skinColor),
   L_Knee:gearRgb('L_Knee',skinColor),R_Knee:gearRgb('R_Knee',skinColor),
   L_Shin:gearRgb('L_Shin',skinColor),R_Shin:gearRgb('R_Shin',skinColor),
   sockC:gearRgb('sockC','#ffffff'),shoeC:gearRgb('shoeC','#ffffff'),soleC:gearRgb('soleC','#202020')
  };
  for(let i=0;i<pixels.data.length;i+=4){if(!pixels.data[i+3])continue;
   const r=source[i],g=source[i+1],b=source[i+2],pixel=Math.floor(i/4),x=pixel%32,y=Math.floor(pixel/32);
   let next;
   const skinScale=skinShades[`${r},${g},${b}`];
   if(team?.suitPreview&&r===195&&g===36&&b===58)next=suitColor('shoeC','#000000');
   else if(skinScale!==undefined)next=shade(skin,skinScale);
   else if(team?.refereePreview)continue;
   else if(team?.suitPreview){
    if(b===255&&r<=35){
     const key=r===5?'tieC':r===10?'shirtC':r===25||r===35?'pantC':'jacketC';
     next=shade(suitColor(key,key==='shirtC'?'#ffffff':key==='tieC'?'#77202d':'#262539'),r===30||r===35?.7:1);
    }else if(r===200&&g===255&&b===255)next=suitColor('laceC',color(suit.shoeC,team,'#000000'));
    else if(r===205&&g===172&&b===190)next=suitColor('soleC','#000000');
   }
   else if(b===255&&r<=40){
    const isShorts=y>=shortsStart,row=uniformRows[y],width=row.max-row.min+1;
    const leftEdge=x===row.min,rightEdge=x===row.max;
    // The idle sprite encodes the collar as exactly three light-blue pixels
    // (5,200,255), matching assets/images/jerseys/collar.png. Using that exact mask avoids
    // recoloring nearby jersey pixels and accidentally drawing multiple collars.
    const collar=r===5&&g===200;
    // Hoop Land's front-facing uniform is asymmetric: the viewer-left torso and
    // shorts edge stay in the base uniform color. The upper-left shoulder and
    // viewer-right edges use the configured stripe colors.
    const leftShoulder=!isShorts&&y<=shortsStart-5;
    // Exact shorts-stripe mask includes the isolated hip and inset pixels.
    const isShortsStripe=r===15&&g===150;
    const base=isShorts?shorts:jersey;
    let target=base,direct=false;
    if(isShortsStripe){target=shortsStripe;direct=true}
    else if(collar){target=jerseyCollar;direct=true}
    else if(width>=4&&rightEdge&&y<shortsStart-2){target=jerseyStripe;direct=true}
    else if(width>=4&&leftEdge&&leftShoulder){target=jerseyStripe;direct=true}
    next=direct?target:shade(base,Math.max(.55,Math.min(1.3,g/150)));
   }else if(b===0&&g>=120){
    const key=r<75?'L_Shoulder':r<120?'R_Shoulder':r<150?'L_Knee':'R_Knee';
    next=shade(accessory[key],Math.max(.6,Math.min(1.2,g/175)));
   }else if(g===0&&b>=100){
    const key=r<90?'L_Elbow':r<130?'R_Elbow':r<160?'L_Shin':'R_Shin';
    next=shade(accessory[key],Math.max(.6,Math.min(1.2,b/200)));
   }else if(b===150&&g>=100){
    const key=r<100?'L_Wrist':r<150?'R_Wrist':'sockC';
    next=shade(accessory[key],Math.max(.6,Math.min(1.1,g/150)));
   }else if(r===200&&g===255&&b===255)next=accessory.shoeC;
   else if(r===205&&g===172&&b===190)next=accessory.soleC;
   if(next){pixels.data[i]=next[0];pixels.data[i+1]=next[1];pixels.data[i+2]=next[2]}
  }
  layer.putImageData(pixels,0,0);ctx.drawImage(off,0,0);
  return {uniform,shortsStart}
 }
 function jerseyNumber(ctx,player,team,uniform,shortsStart,scale,offsetY){
  const value=Number(player.num);if(!Number.isInteger(value)||value<0)return;
  const text=String(value).slice(-2),width=text.length*3+(text.length-1);
  // Render jersey digits at pixel resolution, independently of the body scale.
  const startX=Math.floor((ctx.canvas.width-width)/2),startY=(offsetY+shortsStart)*scale-7;
  ctx.fillStyle=color(uniform?.jerseyNumber,team,color(uniform?.jerseyStripe,team,'#ffffff'));
  for(const [index,digit]of [...text].entries()){
   const glyph=numberGlyphs[digit];if(!glyph)continue;
   for(let y=0;y<glyph.length;y++)for(let x=0;x<3;x++)if(glyph[y][x]==='1')ctx.fillRect(startX+index*4+x,startY+y,1,1)
  }
 }
 function draw(canvas,player,team,uniformIndex,frame){
  const ctx=canvas.getContext('2d'),scene=document.createElement('canvas');scene.width=32;scene.height=42;
  const sceneCtx=scene.getContext('2d'),appearance=player.appearance||{},gear=team?.suitPreview?(player.suits?.[uniformIndex]||player.suits?.[0]||{}):(player.accessories?.[uniformIndex]||player.accessories?.[0]||{});
  const offsetY=9;
  sceneCtx.save();sceneCtx.translate(0,offsetY);
  const bodyState=body(sceneCtx,frame,player,team,uniformIndex);sceneCtx.restore();
  // Leave room above the body for hair and accessories.
  sceneCtx.save();sceneCtx.translate(0,offsetY+[-8,-7,-6,-7][frame]);
  paint(sceneCtx,images.head,0,0,hex(appearance.skinC,'#dc8158'));
  paint(sceneCtx,images['eye-white'],0,0);
  paint(sceneCtx,images['eye-color'],0,0,hex(appearance.eyeC,'#472d3c'));
  paint(sceneCtx,images['brow-color'],0,0,hex(appearance.browC,'#262539'));
  if(appearance.unibrow)paint(sceneCtx,images['unibrow-color'],0,0,hex(appearance.browC,'#262539'));
  atlas(sceneCtx,images['facial-hair'],appearance.fHair,8,hex(appearance.fHairC,'#262539'),0);
  atlas(sceneCtx,images.hair,appearance.hair,16,hex(appearance.hairC,'#262539'),0);
  if(gear.headAcc!=='none')atlas(sceneCtx,images['head-accessories'],gear.headAcc,8,color(gear.headAccC,team,'#ffffff'),0);
  atlas(sceneCtx,images['head-accessories'],gear.headAcc2,8,color(gear.headAcc2C,team,'#ffffff'),0);
  sceneCtx.restore();
  const scale=canvas.width/32;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(scene,0,0,scene.width,scene.height,0,0,canvas.width,canvas.height);
  if(bodyState&&!team?.refereePreview&&!team?.suitPreview)jerseyNumber(ctx,player,team,bodyState.uniform,bodyState.shortsStart,scale,offsetY)
 }
 function drawPortrait(canvas,player,team,uniformIndex){
  const source=document.createElement('canvas');source.width=128;source.height=168;
  draw(source,player,team,uniformIndex,0);
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
  // Keep the square shoulder crop proportional inside the portrait frame.
  const size=Math.min(canvas.width,canvas.height),x=(canvas.width-size)/2,y=(canvas.height-size)/2;
  ctx.save();
  ctx.translate(canvas.width,0);
  ctx.scale(-1,1);
  ctx.drawImage(source,18,12,92,92,x,y,size,size);
  ctx.restore()
 }
 window.HLSPlayerPreview={
  mount(canvas,state){let frame=0;
   const redraw=()=>{if(canvas.isConnected){const {player,team,uniformIndex}=state();draw(canvas,player,team,uniformIndex,frame)}};
   const tick=()=>{if(!canvas.isConnected)return;redraw();frame=(frame+1)%4;setTimeout(tick,110)};
   tick();return redraw
  },
  portrait(canvas,state){
   const redraw=()=>{if(canvas.isConnected){const {player,team,uniformIndex=0}=state();drawPortrait(canvas,player,team,uniformIndex)}};
   redraw();
   for(const image of Object.values(images))if(!image.complete)image.addEventListener('load',redraw,{once:true});
   return redraw
  }
 };
})();

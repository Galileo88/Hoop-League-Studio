(()=>{
 const letters=new Image();letters.src='./assets/images/players/team-letters.png';
 const valid=value=>/^[\da-f]{6}$/i.test(String(value||''));
 const rgb=value=>[0,2,4].map(i=>parseInt(value.slice(i,i+2),16));
 const isImage=value=>/^(https?:|data:image|blob:|\/|\.\/)/i.test(value)||/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(value);
 function create(team){
  const icon=document.createElement('span');icon.className='team-icon';icon.dataset.teamLogo='true';
  icon.syncTeamLogo=()=>{
   icon.replaceChildren();
   const primary=rgb(valid(team.teamColors?.[0])?team.teamColors[0]:'147dff');
   const secondary=rgb(valid(team.teamColors?.[1])?team.teamColors[1]:'102737');
   const tertiary=rgb(valid(team.teamColors?.[2])?team.teamColors[2]:'05c8ff');
   const source=String(team.logoURL||'').trim();
   if(source&&isImage(source)){
    const img=document.createElement('img');img.alt='';img.src=source;
    img.onerror=()=>{if(icon.contains(img)){teamLogoLetter(icon,team,primary,secondary,tertiary)}};
    icon.append(img);return
   }
   teamLogoLetter(icon,team,primary,secondary,tertiary)
  };
  icon.syncTeamLogo();return icon
 }
 function teamLogoLetter(icon,team,primary,secondary,tertiary){
  icon.replaceChildren();
  const character=String(team.name||team.shortName||'H').trim().charAt(0).toUpperCase();
  const index=character.charCodeAt(0)-65;
  if(index<0||index>=26){icon.textContent=character||'?';return}
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  canvas.setAttribute('aria-hidden','true');icon.append(canvas);
  const draw=()=>{
   if(!letters.naturalWidth)return;
   const context=canvas.getContext('2d',{willReadFrequently:true});
   context.clearRect(0,0,32,32);context.drawImage(letters,(index%8)*32,Math.floor(index/8)*32,32,32,0,0,32,32);
   const image=context.getImageData(0,0,32,32);
   for(let i=0;i<image.data.length;i+=4){if(!image.data[i+3])continue;
    // The sprite's three blue palette entries represent the team's color slots.
    const source=(image.data[i]<<16)|(image.data[i+1]<<8)|image.data[i+2];
    const color=source===0x147dff?primary:source===0x0aafff?secondary:source===0x05c8ff?tertiary:null;
    if(!color)continue;
    image.data[i]=color[0];image.data[i+1]=color[1];image.data[i+2]=color[2]
   }context.putImageData(image,0,0)
  };
  if(letters.complete)draw();else letters.addEventListener('load',draw,{once:true})
 }
 async function letterCanvas(team){
  await letters.decode();
  const icon=create({...team,logoURL:''}),sprite=icon.querySelector('canvas');
  if(sprite)return sprite;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(icon.textContent,16,16,32);return canvas;
 }
 window.HLSTeamLogo={create,letterCanvas};

})();

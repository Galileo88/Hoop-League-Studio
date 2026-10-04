(()=>{
 const holdDelay=380,repeatEvery=85;
 let heldButton=null,holdTimer=0,repeatTimer=0,didRepeat=false,syntheticRepeat=false,suppressClickButton=null,suppressTimer=0;
 const clearTimers=()=>{clearTimeout(holdTimer);clearInterval(repeatTimer);holdTimer=0;repeatTimer=0};
 const stopHold=()=>{
  if(!heldButton){clearTimers();return}
  const finishedButton=heldButton,shouldSuppress=didRepeat;
  clearTimers();heldButton=null;didRepeat=false;
  if(shouldSuppress){
   suppressClickButton=finishedButton;
   clearTimeout(suppressTimer);
   suppressTimer=setTimeout(()=>{if(suppressClickButton===finishedButton)suppressClickButton=null},600);
  }
 };
 const repeatStep=()=>{
  if(!heldButton||!heldButton.isConnected||heldButton.disabled){stopHold();return}
  syntheticRepeat=true;
  try{heldButton.click()}finally{syntheticRepeat=false}
 };
 document.addEventListener('pointerdown',event=>{
  const button=event.target.closest?.('.number-control button');
  if(!button||button.disabled||(event.pointerType==='mouse'&&event.button!==0))return;
  /* Reducing Total Teams permanently deletes teams and already requires confirmation, so keep that one single-step. */
  if(button.getAttribute('aria-label')==='Remove one team')return;
  stopHold();
  heldButton=button;didRepeat=false;
  try{button.setPointerCapture?.(event.pointerId)}catch{}
  holdTimer=setTimeout(()=>{
   if(!heldButton||heldButton.disabled)return;
   didRepeat=true;repeatStep();
   repeatTimer=setInterval(repeatStep,repeatEvery);
  },holdDelay);
 },true);
 document.addEventListener('pointerup',stopHold,true);
 document.addEventListener('pointercancel',stopHold,true);
 document.addEventListener('lostpointercapture',stopHold,true);
 document.addEventListener('click',event=>{
  if(syntheticRepeat||!suppressClickButton)return;
  const button=event.target.closest?.('.number-control button');
  if(button!==suppressClickButton)return;
  event.preventDefault();event.stopImmediatePropagation();
  suppressClickButton=null;clearTimeout(suppressTimer);suppressTimer=0;
 },true);
})();


/* Keep browser-style image and pinch gestures out of the app while preserving text editing. */
(()=>{
  const mediaSelector='img,canvas,.uniform-preview-stage';
  const isMediaTarget=target=>target instanceof Element&&!!target.closest(mediaSelector);

  document.addEventListener('gesturestart',event=>event.preventDefault(),{passive:false});
  document.addEventListener('gesturechange',event=>event.preventDefault(),{passive:false});
  document.addEventListener('gestureend',event=>event.preventDefault(),{passive:false});
  document.addEventListener('touchmove',event=>{
    if(event.touches&&event.touches.length>1)event.preventDefault();
  },{passive:false,capture:true});
  document.addEventListener('wheel',event=>{
    if(event.ctrlKey)event.preventDefault();
  },{passive:false,capture:true});

  document.addEventListener('dragstart',event=>{
    if(isMediaTarget(event.target))event.preventDefault();
  },true);
  document.addEventListener('contextmenu',event=>{
    if(isMediaTarget(event.target))event.preventDefault();
  },true);
  document.addEventListener('copy',event=>{
    if(isMediaTarget(event.target)){event.preventDefault();return}
    const selection=window.getSelection?.();
    if(!selection||selection.rangeCount===0||selection.isCollapsed)return;
    try{
      const fragment=selection.getRangeAt(0).cloneContents();
      if(fragment.querySelector?.(mediaSelector))event.preventDefault();
    }catch{}
  },true);
  document.addEventListener('paste',event=>{
    const items=Array.from(event.clipboardData?.items||[]);
    if(items.some(item=>String(item.type||'').toLowerCase().startsWith('image/')))event.preventDefault();
  },true);
})();

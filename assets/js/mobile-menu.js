
(()=>{
 const body=document.body,menu=document.getElementById('mobileMenu'),close=document.getElementById('mobileClose'),scrim=document.getElementById('mobileScrim'),sidebar=document.getElementById('mobileSidebar');
 if(!menu||!close||!scrim||!sidebar)return;
 let returnFocus=null;
 const isMobile=()=>window.matchMedia('(max-width:760px)').matches;
 const setOpen=open=>{
  const next=Boolean(open&&isMobile());
  body.classList.toggle('mobile-nav-open',next);
  menu.setAttribute('aria-expanded',String(next));
  scrim.setAttribute('aria-hidden',String(!next));
  if(next){returnFocus=document.activeElement;requestAnimationFrame(()=>close.focus())}
  else if(returnFocus&&isMobile()){const target=returnFocus;returnFocus=null;requestAnimationFrame(()=>target?.focus?.())}
 };
 menu.addEventListener('click',()=>setOpen(!body.classList.contains('mobile-nav-open')));
 close.addEventListener('click',()=>setOpen(false));
 scrim.addEventListener('click',()=>setOpen(false));
 sidebar.addEventListener('click',event=>{if(event.target.closest('.nav,.team'))setOpen(false)});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&body.classList.contains('mobile-nav-open'))setOpen(false)});
 window.addEventListener('resize',()=>{if(!isMobile()&&body.classList.contains('mobile-nav-open'))setOpen(false)},{passive:true});
})();

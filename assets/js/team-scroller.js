(()=>{
 function enhanceTeamScroller(){
  const teams=document.getElementById('teams');
  if(!teams||teams.closest('.team-scroll-shell'))return;
  const shell=document.createElement('div'),hint=document.createElement('div');
  shell.className='team-scroll-shell';hint.className='team-scroll-hint';hint.setAttribute('aria-hidden','true');
  teams.parentNode.insertBefore(shell,teams);shell.append(teams,hint);
  const sync=()=>{
   const overflow=teams.scrollHeight>teams.clientHeight+2;
   const canScrollUp=overflow&&teams.scrollTop>2;
   const canScrollDown=overflow&&teams.scrollTop+teams.clientHeight<teams.scrollHeight-2;
   shell.classList.toggle('can-scroll-up',canScrollUp);
   shell.classList.toggle('can-scroll-down',canScrollDown)
  };
  teams.addEventListener('scroll',sync,{passive:true});
  if('ResizeObserver'in window)new ResizeObserver(sync).observe(teams);
  new MutationObserver(()=>requestAnimationFrame(sync)).observe(teams,{childList:true,subtree:true});
  requestAnimationFrame(sync)
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceTeamScroller,{once:true});else enhanceTeamScroller();

})();

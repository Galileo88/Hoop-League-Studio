(() => {
  const mobile = navigator.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (mobile || installed) {
    // Mobile visitors and installed browser apps open Getting Started directly.
    document.documentElement.style.visibility = 'hidden';
    location.replace('./app.html');
    return;
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  document.addEventListener('DOMContentLoaded', () => {
    const cards = [...document.querySelectorAll('.option')];
    const options = document.querySelector('.options');
    if (!options) return;
    // Match the closed cards without letting an expanded note resize its neighbors.
    const sizeCards = () => {
      const heights = cards.map(card => {
        const measure = card.cloneNode(true);
        measure.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        measure.removeAttribute('aria-labelledby');
        measure.querySelectorAll('details').forEach(note => { note.open = false; });
        Object.assign(measure.style, {
          position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
          width: `${card.getBoundingClientRect().width}px`, minHeight: '0'
        });
        measure.setAttribute('aria-hidden', 'true');
        options.append(measure);
        const height = measure.getBoundingClientRect().height;
        measure.remove();
        return height;
      });
      const height = `${Math.ceil(Math.max(...heights))}px`;
      cards.forEach(card => { card.style.minHeight = height; });
    };
    sizeCards();
    // Observe width changes only; opening a note must not change the baseline.
    let width = options.getBoundingClientRect().width;
    new ResizeObserver(() => {
      const nextWidth = options.getBoundingClientRect().width;
      if (nextWidth !== width) { width = nextWidth; sizeCards(); }
    }).observe(options);
    document.fonts.ready.then(sizeCards);
  }, { once: true });
})();

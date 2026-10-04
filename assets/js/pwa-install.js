// Keep offline support without showing an installation notification.
(() => {
  if (!['http:', 'https:'].includes(location.protocol)) return;
  window.addEventListener('beforeinstallprompt', event => event.preventDefault());
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }, { once: true });
  }
})();

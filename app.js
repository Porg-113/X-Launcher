'use strict';

(() => {
  const baseUrl = new URL('app.parts/', document.currentScript.src);
  const parts = ["part-01.jsfrag","part-02.jsfrag","part-03.jsfrag","part-04.jsfrag"];
  const loadPart = (name) => new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', new URL(name, baseUrl).href, true);
    request.onload = () => {
      if (request.status === 0 || (request.status >= 200 && request.status < 300)) {
        resolve(request.responseText);
      } else {
        reject(new Error('Could not load ' + name));
      }
    };
    request.onerror = () => reject(new Error('Could not load ' + name));
    request.send();
  });

  // Keep Electron responsive at startup: the loading screen can paint while
  // the split renderer source is read in parallel instead of blocking on I/O.
  Promise.all(parts.map(loadPart)).then((sources) => {
    Function(sources.join('') + '\n//# sourceURL=x-client-renderer.bundle.js')();
  }).catch((error) => {
    console.error('Could not load the X Client renderer:', error);
    const message = document.querySelector('#loading-text, #loading-message');
    if (message) message.textContent = 'Launcher-Dateien konnten nicht geladen werden.';
  });
})();
